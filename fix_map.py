import re

with open('src/components/GeofenceMobileMap.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change flex: 1 to height: 250 in the container style
content = re.sub(
    r"container: \{\s*flex: 1,\s*width: '100%',\s*backgroundColor: '#0f172a'\s*\},",
    "container: {\n    height: 250,\n    width: '100%',\n    backgroundColor: '#0f172a',\n    borderRadius: 16,\n    overflow: 'hidden',\n    borderWidth: 1,\n    borderColor: '#1e293b',\n    marginVertical: 12\n  },",
    content
)

with open('src/components/GeofenceMobileMap.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated GeofenceMobileMap.tsx")