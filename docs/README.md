# APK final para avaliação — SmartCitys

## Baixar e instalar

**[Baixar SmartCitys 1.0.2 para Android](https://github.com/Lobiroka/SmartCitys/raw/refs/heads/main/docs/SmartCitys-1.0.2.apk)**

1. Abra o link no Android ou transfira o arquivo para o emulador/celular.
2. Abra o APK e autorize a instalação pelo navegador ou gerenciador de arquivos, quando o Android solicitar.
3. Abra **SmartCitys** e use **Criar conta** ou entre com uma conta de testes.

O APK funciona com a API HTTPS publicada e dispensa Metro ou Expo Go. Para avaliar
o painel do gestor, a equipe fornece uma conta de testes com o papel `gestor`.

[Download alternativo no Expo](https://expo.dev/artifacts/eas/wzHDfBIjJpJ1IO0ue4f749Alez2Vzrt7YCiAjulM_Iw.apk)
· [Build EAS](https://expo.dev/accounts/dkartss-team/projects/wb/builds/f0bce9b6-f868-44c0-8b1a-db11d847c50b)
· [Evidências do aceite completo](tas-evidence/final-apk-1.0.2-2026-11-24/README.md)
· [Documentação OpenAPI](api/openapi.json).

## Versão e integridade

- Arquivo: [SmartCitys-1.0.2.apk](SmartCitys-1.0.2.apk), 143.512.728 bytes.
- Pacote: `com.darkartsbm.smartcitys`; versionCode `3`; runtime `1.0.2`.
- Código compilado: `18dfe1cf597019c276839764b8db43da7244b223`.
- SHA-256: `a2eacb1759627fc826a9499a489be3386fb67f5ab2b52b77711f5d6e1b7eb20b`.

O mesmo APK passou no fluxo completo em dois emuladores: cadastro/login, demanda
com foto e GPS, filtros, atualização pelo gestor e push real ao cidadão, sem Metro.

## Para quem clona o repositório

O arquivo utiliza **Git LFS**, pois excede o limite de 100 MiB do GitHub para Git
comum. Pelo navegador, use o link de download acima. Para obter o binário em um
clone com Git LFS instalado:

```bash
git lfs pull --include="docs/SmartCitys-1.0.2.apk"
```

Um arquivo de poucos bytes iniciado por `version https://git-lfs.github.com/spec/v1`
é o ponteiro LFS; ele não é o instalador. O APK deve ter o tamanho e hash acima.
