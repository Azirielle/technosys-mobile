import os

def fix_dates(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace("{ month: 'short', day: 'numeric', year: 'numeric' }", "{ month: 'long', day: 'numeric', year: 'numeric' }")
    content = content.replace("{ month: 'short', day: 'numeric' }", "{ month: 'long', day: 'numeric' }")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_dates('src/app/index.tsx')
if os.path.exists('src/components/TicketsTab.tsx'):
    fix_dates('src/components/TicketsTab.tsx')
