export const environment = {
  production: false,
  country: 'australia',
  defaultFhirServerIndex: 5,

  allergyList: {
    enableNotes: true,
    enablePropensity: false,
    enablePatient: true,
    enableExposureRoute: false,

    codeBinding: {
      ecl: '<<418038007 |Propensity to adverse reactions to substance| OR <<420134006 |Propensity to adverse reaction (finding)|',
      title: 'Allergy/Intolerance by propensity'
    },
    substanceBinding: { 
      ecl: '<<105590001 | Substance (substance) | OR <<373873005 | Pharmaceutical / biologic product (product) |',
      title: 'Allergy/Intolerance substance or product'
    },
    refinedSubstanceBinding: { 
      ecl: '<<105590001 | Substance (substance) |',
      title: 'Allergy/Intolerance substance based on propensity'
    },
    reactionManifestationBinding: { 
      ecl: '<<404684003 | Clinical finding |',
      title: 'Reaction Manifestation'
    },
    routeBinding: { 
      ecl: '<<284009009 | Route of administration value |',
      title: 'Exposure Route'
    }
  }
};