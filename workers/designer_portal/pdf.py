"""Branded client PDF from an allowlisted estimate projection, never a project draft."""
from __future__ import annotations
import io
from decimal import Decimal
from html import escape


def render_estimate(estimate: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    def clean(value, limit=2000):
        return escape(str(value)[:limit])

    def money(value):
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError('Invalid monetary output')
        return f'£{Decimal(value)/100:,.2f}'

    if estimate.get('schemaVersion') != 1 or estimate.get('currency') != 'GBP':
        raise ValueError('Unsupported estimate output')
    rows = estimate.get('lines', [])
    if len(rows) > 2000:
        raise ValueError('Estimate line limit exceeded')
    ready = estimate.get('status') == 'ready'
    subtotal = sum(x['amountPence'] for x in rows)
    if subtotal != estimate.get('subtotalPence'):
        raise ValueError('Estimate line total mismatch')
    if ready and (not isinstance(estimate.get('vatPence'), int) or estimate.get('totalPence') != subtotal + estimate['vatPence']):
        raise ValueError('Estimate total mismatch')
    vat_rate = estimate.get('vatRateBps')
    if ready and (isinstance(vat_rate, bool) or not isinstance(vat_rate, int) or not 0 <= vat_rate <= 10000):
        raise ValueError('Confirmed VAT rate is required')
    if ready and estimate['vatPence'] != (subtotal * vat_rate + 5000) // 10000:
        raise ValueError('Estimate VAT calculation mismatch')
    output = io.BytesIO()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Brand', fontName='Times-Roman', fontSize=28, leading=32, textColor=colors.HexColor('#252b27')))
    styles.add(ParagraphStyle(name='SmallPrint', fontName='Helvetica', fontSize=9, leading=13))
    doc = SimpleDocTemplate(output, pagesize=(210*mm, 297*mm), rightMargin=18*mm, leftMargin=18*mm, topMargin=18*mm, bottomMargin=22*mm, title='Mr Wallcover indicative estimate', author='Mr Wallcover')
    content = [Paragraph('Mr Wallcover', styles['Brand']), Spacer(1, 5*mm), Paragraph('INDICATIVE PROJECT ESTIMATE' if ready else 'SCOPE REVIEW — ESTIMATE INCOMPLETE', styles['Heading2'])]
    if estimate.get('projectName'):
        content.append(Paragraph(clean(estimate['projectName']), styles['Heading3']))
    address = estimate.get('projectAddress')
    if isinstance(address, dict):
        content.append(Paragraph(', '.join(clean(address[k]) for k in ('line1','line2','town','postcode','country') if address.get(k)), styles['Normal']))
    content += [Paragraph(f'Reference: {clean(estimate.get("estimateId", ""))}', styles['Normal']), Paragraph(f'Issued: {clean(estimate.get("createdAt", ""))[:10]} · Valid until: {clean(estimate.get("validUntil", ""))[:10]}', styles['Normal']), Spacer(1, 6*mm)]
    table = [[Paragraph('Work and inclusions', styles['SmallPrint']), 'Amount']]
    for row in rows:
        text = f'<b>{clean(row.get("label", ""))}</b><br/>{clean(row.get("quantity", ""))} {clean(row.get("unit", ""))}<br/>{clean(row.get("inclusion", ""))}'
        table.append([Paragraph(text, styles['SmallPrint']), money(row['amountPence'])])
    table.append(['Subtotal' if ready else 'Priced work only — incomplete', money(subtotal)])
    if ready:
        table += [[f'VAT ({Decimal(vat_rate)/100:g}%)', money(estimate['vatPence'])], ['Total including VAT', money(estimate['totalPence'])]]
    grid = Table(table, colWidths=[130*mm, 43*mm], repeatRows=1, hAlign='LEFT')
    grid.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeece4')),('LINEBELOW',(0,0),(-1,-1),0.4,colors.HexColor('#d9d7ce')),('VALIGN',(0,0),(-1,-1),'TOP'),('ALIGN',(1,0),(1,-1),'RIGHT'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    content += [grid, Spacer(1,6*mm), Paragraph('Scope and assumptions', styles['Heading3'])]
    for note in estimate.get('assumptions', []):
        content.append(Paragraph(clean(note), styles['SmallPrint']))
    for issue in estimate.get('reviewReasons', []):
        content.append(Paragraph('Outstanding: '+clean(issue.get('message','')), styles['SmallPrint']))
    content += [Spacer(1,5*mm), Paragraph('All wallcoverings, lining paper, primers and adhesives are supplied by the client. This is a budget estimate; a firm quotation requires Mr Wallcover review. Site surveying is priced separately where stated.', styles['SmallPrint'])]

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont('Helvetica', 9)
        canvas.drawString(18*mm, 12*mm, 'mrwallcover.com  |  info@mrwallcover.com')
        canvas.drawRightString(192*mm, 12*mm, f'Page {document.page}')
        canvas.restoreState()
    doc.build(content, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
