import io
import unittest
import zipfile
from documents import extract_evidence, verify_document, safe_zip
from pdf import render_estimate


class DocumentsTest(unittest.TestCase):
    def test_labelled_dimensions_remain_unconfirmed(self):
        output = extract_evidence(b'Ceiling height: 2.7 m\nProduct code: EXAMPLE-1\nScale 1:50', 'survey.txt', 'doc-1')
        self.assertEqual(len([e for e in output['evidence'] if e['kind']=='dimension']), 1)
        self.assertTrue(all(e['confirmed'] is False for e in output['evidence']))
        self.assertTrue(all(e['source']['documentId']=='doc-1' for e in output['evidence']))

    def test_unsupported_or_fake_pdf_rejected(self):
        for name in ['payload.html', 'drawing.pdf', 'picture.png']:
            with self.assertRaises(Exception):
                verify_document(b'<html>script</html>', name)

    def test_zip_traversal_rejected(self):
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z: z.writestr('../outside.xml','bad')
        with self.assertRaises(ValueError): safe_zip(out.getvalue())

    def test_macros_rejected(self):
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            z.writestr('xl/workbook.xml','<workbook/>');z.writestr('xl/vbaProject.bin','bad')
        with self.assertRaises(ValueError): verify_document(out.getvalue(),'scope.xlsx')

    def test_xlsx_formula_without_cache_is_not_zero(self):
        from openpyxl import Workbook
        out=io.BytesIO();book=Workbook();book.active['A1']='=1+1';book.active['B1']='Wall width: 3000 mm';book.save(out)
        result=extract_evidence(out.getvalue(),'schedule.xlsx','doc-2')
        self.assertTrue(any('no cached value' in w for w in result['warnings']))
        self.assertFalse(any(e['source'].get('cell')=='A1' for e in result['evidence']))

    def test_native_document_stays_for_review(self):
        result=extract_evidence(b'AC1032 native fixture', 'drawing.dwg', 'doc-3')
        self.assertEqual(result['evidence'],[])
        self.assertIn('PDF export',result['warnings'][0])

    def test_nested_pdf_annotation_and_form_actions_are_rejected(self):
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject, ArrayObject, NameObject, TextStringObject
        for parent in ('annotation', 'form'):
            writer = PdfWriter(); page = writer.add_blank_page(width=100, height=100)
            action = DictionaryObject({NameObject('/S'): NameObject('/JavaScript'), NameObject('/JS'): TextStringObject('synthetic test')})
            nested = DictionaryObject({NameObject('/A'): writer._add_object(action)})
            if parent == 'annotation':
                page[NameObject('/Annots')] = ArrayObject([writer._add_object(nested)])
            else:
                writer._root_object[NameObject('/AcroForm')] = DictionaryObject({NameObject('/Fields'): ArrayObject([writer._add_object(nested)])})
            output = io.BytesIO(); writer.write(output)
            with self.assertRaisesRegex(ValueError, 'Active'): verify_document(output.getvalue(), 'drawing.pdf')

    def estimate(self):
        return {'schemaVersion':1,'estimateId':'TEST-ONLY','status':'ready','currency':'GBP','createdAt':'2026-10-18','validUntil':'2026-11-17',
                'lines':[{'label':'Example installation','inclusion':'Client-supplied materials','amountPence':12000}],
                'subtotalPence':12000,'vatRateBps':2000,'vatPence':2400,'totalPence':14400,'assumptions':['Synthetic verification fixture'],'reviewReasons':[],
                'propertyValuePence':3000000000,'contact':{'email':'private@example.invalid'}}

    def test_pdf_totals_and_private_fields(self):
        from pypdf import PdfReader
        result=render_estimate(self.estimate())
        text='\n'.join(p.extract_text() for p in PdfReader(io.BytesIO(result)).pages)
        self.assertIn('144.00',text);self.assertIn('Mr Wallcover',text);self.assertIn('VAT (20%)',text)
        self.assertNotIn('private@example.invalid',text);self.assertNotIn('3000000000',text)

    def test_pdf_rejects_inconsistent_total(self):
        data=self.estimate();data['totalPence']=12000
        with self.assertRaises(ValueError):render_estimate(data)

    def test_pdf_rejects_missing_or_inconsistent_vat_rate(self):
        for rate in (None, True, 1000):
            data=self.estimate();data['vatRateBps']=rate
            with self.assertRaises(ValueError):render_estimate(data)

    def test_pdf_cannot_present_partial_total_as_complete(self):
        from pypdf import PdfReader
        data=self.estimate();data.update(status='review_required',totalPence=None,vatPence=None)
        text='\n'.join(p.extract_text() for p in PdfReader(io.BytesIO(render_estimate(data))).pages)
        self.assertIn('INCOMPLETE',text);self.assertNotIn('Total including VAT',text)


if __name__=='__main__': unittest.main()
