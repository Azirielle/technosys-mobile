import os

def fix_payslip_dates(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Format period_start and period_end correctly
    content = content.replace("{payslip.period_start}", "{new Date(payslip.period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}")
    content = content.replace("{payslip.period_end}", "{new Date(payslip.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}")
    content = content.replace("{payslip?.period_start}", "{payslip?.period_start ? new Date(payslip.period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}")
    content = content.replace("{payslip?.period_end}", "{payslip?.period_end ? new Date(payslip.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_payslip_dates('src/app/index.tsx')
