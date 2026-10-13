"""Permite HTTP somente no localhost do APK gerado para o emulador CI."""
from pathlib import Path
import xml.etree.ElementTree as ET

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
    <domain>localhost</domain>
  </domain-config>
</network-security-config>
''', encoding='utf-8')
