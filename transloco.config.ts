import { TranslocoGlobalConfig } from '@jsverse/transloco-keys-manager';

const config: TranslocoGlobalConfig = {
  rootTranslationsPath: 'src/assets/i18n/',
  langs: ['en', 'es'],
  keysManager: {
    input: 'src/app',
    output: 'src/assets/i18n',
    addMissingKeys: true,
    emitErrorOnExtraKeys: false,
    scopes: {
      'benefits-demo': {
        input: 'src/app/benefits-demo',
        output: 'src/assets/i18n/benefits-demo',
      },
    },
  },
};

export default config;
