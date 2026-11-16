"""Configura a rede e a JVM do APK gerado para o emulador da CI."""
from pathlib import Path
import xml.etree.ElementTree as ET

gradle_properties = Path('android/gradle.properties')
properties = gradle_properties.read_text(encoding='utf-8').splitlines()
properties = [
    line for line in properties if not line.strip().startswith('org.gradle.jvmargs=')
]
properties.append(
    'org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8'
)
gradle_properties.write_text('\n'.join(properties) + '\n', encoding='utf-8')

android = Path('android/app/src/main')
namespace = 'http://schemas.android.com/apk/res/android'
ET.register_namespace('android', namespace)
manifest = android / 'AndroidManifest.xml'
tree = ET.parse(manifest)
application = tree.getroot().find('application')
if application is None:
    raise RuntimeError('AndroidManifest.xml sem application')
application.set(f'{{{namespace}}}networkSecurityConfig', '@xml/ci_network_security')
tree.write(manifest, encoding='utf-8', xml_declaration=True)
resources = android / 'res/xml'
resources.mkdir(parents=True, exist_ok=True)
(resources / 'ci_network_security.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
  </domain-config>
</network-security-config>
''', encoding='utf-8')
