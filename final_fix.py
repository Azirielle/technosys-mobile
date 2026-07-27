import os

def final_fix(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        c = f.read()

    # Fix Import
    c = c.replace(
        "import { TicketsTab } from '../components/TicketsTab';",
        "import { TicketsTab } from '../components/TicketsTab';\nimport SchedulesTab from '../components/SchedulesTab';"
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(c)

final_fix('src/app/index.tsx')
