import json

with open('app.json', 'r') as f:
    data = json.load(f)

data['expo']['android']['package'] = 'com.technosys.hrismobile'

with open('app.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Updated app.json")
