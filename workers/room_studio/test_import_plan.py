"""Real, original PDF/image fixtures; never calls a model or downloads OCR weights.

Use a Python runtime with pdfplumber, Pillow, numpy, pypdfium2 and reportlab.
The vector-only path is usable without OpenCV; raster/OCR availability is reported.
"""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

from import_plan import extract_evidence, candidate_from_proposal, PlanError, _dimension_mm, _source_present

DEPS=all(importlib.util.find_spec(name) for name in ('pdfplumber','PIL','numpy','pypdfium2','reportlab'))


@unittest.skipUnless(DEPS,'PDF fixture dependencies unavailable in this Python runtime')
class PlanExtractionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='mw-original-plan-fixture-')
        self.folder=Path(self.temp.name)
        os.environ.pop('ROOM_STUDIO_LIVE_AI_ENABLED',None)

    def tearDown(self):
        self.temp.cleanup()

    def make_pdf(self,label='4 m',rotation=0,two_rooms=False,pages=1):
        from reportlab.pdfgen import canvas
        path=self.folder/'original-schematic.pdf'
        drawing=canvas.Canvas(str(path),pagesize=(600,400))
        for _ in range(pages):
            drawing.setPageRotation(rotation)
            drawing.rect(30,60,240,240)
            drawing.drawString(50,315,label)
            if two_rooms:
                drawing.rect(330,60,240,240)
                drawing.drawString(350,315,'6 m')
            drawing.showPage()
        drawing.save()
        return path

    def proposal(self,evidence,label='4 m',length=4000):
        edges=evidence['lines']
        left=min(min(e['x1'],e['x2']) for e in edges)
        right=max(max(e['x1'],e['x2']) for e in edges)
        top=min(min(e['z1'],e['z2']) for e in edges)
        bottom=max(max(e['z1'],e['z2']) for e in edges)
        return {'verticesPx':[[left,top],[right,top],[right,bottom],[left,bottom]],'openings':[],'scaleEvidence':{'fromPx':[left,top],'toPx':[right,top],'lengthMm':length,'sourceText':label},'ceilingHeightMm':None,'ceilingHeightSource':''}

    def test_metric_vector_pdf_preserves_unknown_height(self):
        evidence=extract_evidence(str(self.make_pdf()))
        self.assertIn('4 m',evidence['text'])
        self.assertGreaterEqual(len(evidence['lines']),4)
        self.assertTrue(evidence['previewBase64'].startswith('iVBOR'))
        result=candidate_from_proposal(self.proposal(evidence),evidence)
        self.assertTrue(result['scaleKnown'])
        self.assertFalse(result['heightKnown'])
        self.assertEqual(result['room']['heightMm'],0,'unknown height cannot masquerade as a valid measured room')
        self.assertFalse(result['room']['confirmed'])
        self.assertEqual(result['room']['vertices'][1]['x'],4000)
        self.assertTrue(any(issue['path']=='room.heightMm' for issue in result['issues']))

    def test_unknown_opening_heights_are_omitted_with_explicit_measurement_tasks(self):
        evidence=extract_evidence(str(self.make_pdf()))
        proposal=self.proposal(evidence)
        proposal['openings']=[{'kind':'door','wallIndex':0,'offsetPx':20,'widthPx':50},{'kind':'window','wallIndex':1,'offsetPx':30,'widthPx':60}]
        result=candidate_from_proposal(proposal,evidence)
        self.assertEqual(result['room']['openings'],[])
        tasks=[issue['message'] for issue in result['issues'] if issue['path'].startswith('room.openings.')]
        self.assertEqual(len(tasks),2)
        self.assertTrue(all('was not added' in task and 'measured dimensions' in task for task in tasks))
        self.assertTrue(any('door' in task for task in tasks))
        self.assertTrue(any('window' in task for task in tasks))

    def test_ceiling_height_must_match_an_explicit_extracted_height_label(self):
        evidence=extract_evidence(str(self.make_pdf(label='4 m; Ceiling height: 2.6 m')))
        proposal=self.proposal(evidence)
        proposal.update(ceilingHeightMm=2600,ceilingHeightSource='Ceiling height: 2.6 m')
        result=candidate_from_proposal(proposal,evidence)
        self.assertTrue(result['heightKnown']);self.assertEqual(result['room']['heightMm'],2600)
        proposal['ceilingHeightMm']=2800
        result=candidate_from_proposal(proposal,evidence)
        self.assertFalse(result['heightKnown']);self.assertEqual(result['room']['heightMm'],0)
        proposal.update(ceilingHeightMm=4000,ceilingHeightSource='4 m')
        self.assertFalse(candidate_from_proposal(proposal,evidence)['heightKnown'],'wall dimension is not a ceiling height label')

    def test_scale_reference_endpoints_and_full_dimension_token_are_required(self):
        evidence=extract_evidence(str(self.make_pdf()))
        proposal=self.proposal(evidence)
        proposal['scaleEvidence']['fromPx']=[-1,0]
        result=candidate_from_proposal(proposal,evidence)
        self.assertIsNone(result['room'])
        self.assertTrue(any('endpoints' in issue['message'] for issue in result['issues']))
        evidence=extract_evidence(str(self.make_pdf(label='24 m')))
        result=candidate_from_proposal(self.proposal(evidence),evidence)
        self.assertIsNone(result['room'],'4 m cannot be matched inside the printed 24 m dimension')

    def test_uk_grouped_millimetres_keep_their_printed_value(self):
        evidence=extract_evidence(str(self.make_pdf(label='4,000 mm')))
        result=candidate_from_proposal(self.proposal(evidence,label='4,000 mm'),evidence)
        self.assertTrue(result['scaleKnown']);self.assertEqual(result['room']['vertices'][1]['x'],4000)

    def test_rotated_metric_pdf_extracts_dimension_and_vectors(self):
        evidence=extract_evidence(str(self.make_pdf(rotation=90)))
        self.assertIn('4',evidence['text'])
        self.assertIn('m',evidence['text'])
        self.assertGreaterEqual(len(evidence['lines']),4)
        self.assertLessEqual(evidence['widthPx'],2048)
        self.assertLessEqual(evidence['heightPx'],2048)

    def test_explicit_imperial_dimension_is_converted_without_guessing(self):
        evidence=extract_evidence(str(self.make_pdf(label='12 ft 6 in')))
        self.assertIn('12 ft 6 in',evidence['text'])
        result=candidate_from_proposal(self.proposal(evidence,label='12 ft 6 in',length=3810),evidence)
        self.assertTrue(result['scaleKnown'])
        self.assertEqual(result['room']['vertices'][1]['x'],3810)
        partial=candidate_from_proposal(self.proposal(evidence,label='12 ft',length=3658),evidence)
        self.assertIsNone(partial['room'],'feet cannot omit the printed inches component')

    def test_missing_scale_is_not_invented(self):
        evidence=extract_evidence(str(self.make_pdf(label='Room A')))
        proposal=self.proposal(evidence);proposal['scaleEvidence']=None
        result=candidate_from_proposal(proposal,evidence)
        self.assertIsNone(result['room'])
        self.assertFalse(result['scaleKnown'])

    def test_selected_room_crop_excludes_neighbouring_dimension(self):
        evidence=extract_evidence(str(self.make_pdf(two_rooms=True)),crop={'x':0,'y':0,'width':.5,'height':1})
        self.assertIn('4 m',evidence['text'])
        self.assertNotIn('6 m',evidence['text'])
        self.assertTrue(all(0 <= line['x1'] <= evidence['widthPx'] and 0 <= line['x2'] <= evidence['widthPx'] for line in evidence['lines']))

    def test_page_limit(self):
        with self.assertRaisesRegex(PlanError,'200 pages'):
            extract_evidence(str(self.make_pdf(pages=201)))

    def test_raster_reports_missing_dependencies_without_network(self):
        from PIL import Image,ImageDraw
        path=self.folder/'original-schematic.png'
        image=Image.new('RGB',(600,400),'white');draw=ImageDraw.Draw(image);draw.rectangle((30,60,270,300),outline='black',width=4);draw.text((50,30),'4 m',fill='black');image.save(path)
        if not importlib.util.find_spec('cv2'):
            with self.assertRaisesRegex(PlanError,'Raster extraction is unavailable'):
                extract_evidence(str(path))
        elif not importlib.util.find_spec('paddleocr'):
            with self.assertRaisesRegex(PlanError,'OCR is unavailable'):
                extract_evidence(str(path))
        else:
            self.skipTest('Raster OCR intentionally not invoked: model weights are not provisioned in offline tests')




class DimensionUnitTests(unittest.TestCase):
    def test_imperial_symbols_fractional_inches_and_exact_metric_values(self):
        for label,expected in [("12 ft 6 in",3810),("12'-6 1/2\"",3822.7),("6′ 2½″",1892.3),("8 feet",2438.4),("36 in",914.4),("4,000 mm",4000)]:
            self.assertAlmostEqual(_dimension_mm(label),expected,msg=label)
        self.assertFalse(_source_present('12 ft', '12 ft 1/2 in'))
        self.assertFalse(_source_present('12′', '12′ 6½″'))
        for label in ['4000','12 ft 16 in','6 1/0 in','4,5 m','12-ish ft']:
            self.assertIsNone(_dimension_mm(label),label)

if __name__ == '__main__':
    unittest.main(verbosity=2)
