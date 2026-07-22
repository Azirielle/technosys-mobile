import re

with open(r'android\app\build.gradle', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'versionName "1\.0\.0"', 'versionName "0.5.0"', content)

# Check if there is any archivesBaseName or baseName logic that might rename the APK
if "TechnoSys_ver" not in content:
    content += '\n\nandroid.applicationVariants.all { variant ->\n    variant.outputs.all { output ->\n        outputFileName = "TechnoSys_ver.0.5.0.apk"\n    }\n}\n'

with open(r'android\app\build.gradle', 'w', encoding='utf-8') as f:
    f.write(content)
