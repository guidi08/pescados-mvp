# Publicação do app (Expo / EAS)

## Android (Play Console)

1. Crie conta de desenvolvedor Google Play
2. Crie app no Play Console
3. Configure `eas.json` e rode:
   - `eas build -p android --profile production`
4. Suba o AAB no Play Console (Internal testing primeiro)
5. Configure políticas, privacidade e conteúdo

## iOS (App Store Connect)

1. Apple Developer Program
2. Crie app no App Store Connect
3. Ajuste `app.json`:
   - `ios.bundleIdentifier`
4. Build:
   - `eas build -p ios --profile production`
5. Suba via EAS (ou Transporter)
6. TestFlight → revisão → produção

## Apple Pay (se usar)

- Criar Merchant ID no Apple Developer
- Configurar domínios e certificados (dependendo do método)
- Ajustar no app:
  - `merchantIdentifier` no `StripeProvider`
  - `merchantCountryCode: 'BR'`

## Google Pay

- Em produção, configure o ambiente do Google Pay conforme a documentação do provedor.
- No MVP, `testEnv` fica ligado no modo dev.
