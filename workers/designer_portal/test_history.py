import json
from pathlib import Path
import tempfile
import unittest
from openpyxl import Workbook
from history import prepare_entries, write_private_export


class HistoricalScopeTest(unittest.TestCase):
    def fixture(self, directory):
        path = directory/'synthetic.xlsx'
        workbook = Workbook(); worksheet = workbook.active; worksheet.title = 'Scope'
        worksheet['B4'] = 'Synthetic hanging'; worksheet['C4'] = 26; worksheet['D4'] = 20; worksheet['E4'] = None
        workbook.save(path)
        return {'records': [{'id':'synthetic-old', 'source':str(path), 'title':'Synthetic old source', 'locations':['Scope!B4:E4'], 'classification':'mixed-schedule', 'scope':'Old labour and delivery structure', 'quantityBasis':'m2/item', 'reviewedOn':'2026-10-18', 'priceEvidence':[{'reference':'Scope!C4','label':'Historical selling observation','role':'selling'},{'reference':'Scope!D4','label':'Historical worker observation','role':'worker-cost'},{'reference':'Scope!E4','label':'Unpriced line','role':'unpriced'}]}]}

    def test_observations_keep_provenance_roles_and_unknown_values(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = prepare_entries(self.fixture(Path(temporary)))
            self.assertEqual(result[0]['source']['fileName'],'synthetic.xlsx')
            self.assertEqual(len(result[0]['source']['sha256']),64)
            self.assertEqual([row['role'] for row in result[0]['amounts']],['selling','worker-cost','unpriced'])
            self.assertIsNone(result[0]['amounts'][2]['valuePence'])

    def test_no_inferred_worksheet_or_uncached_amount(self):
        with tempfile.TemporaryDirectory() as temporary:
            review = self.fixture(Path(temporary)); review['records'][0]['locations']=['B4:E4']
            with self.assertRaisesRegex(ValueError,'worksheet'):prepare_entries(review)
            review['records'][0]['locations']=['Scope!B4:E4']; review['records'][0]['priceEvidence'][2]['role']='selling'
            with self.assertRaisesRegex(ValueError,'numeric cached'):prepare_entries(review)

    def test_private_export_cannot_enter_public_repo_or_replace_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary); public=root/'website'; public.mkdir()
            review=root/'review.json'; review.write_text(json.dumps(self.fixture(root)))
            with self.assertRaisesRegex(ValueError,'outside'):write_private_export(review,public/'private.json',public)
            output=root/'private-export.json'; result=write_private_export(review,output,public)
            self.assertFalse(result['currentRatesImported']);self.assertEqual(output.stat().st_mode & 0o777,0o600)
            with self.assertRaises(FileExistsError):write_private_export(review,output,public)


if __name__=='__main__':unittest.main()
