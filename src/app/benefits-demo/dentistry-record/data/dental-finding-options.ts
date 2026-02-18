import { SnomedConceptOption } from '../models/tooth.model';

export const DENTAL_FINDING_OPTIONS: SnomedConceptOption[] = [

  // -------------------------
  // Surface-level findings
  // -------------------------

  {
    code: "733943001",
    display: "Primary active dental caries extending into inner third of dentin",
    scope: "surface"
  },
  {
    code: "733942006",
    display: "Primary active dental caries extending into middle third of dentin",
    scope: "surface"
  },
  {
    code: "733941004",
    display: "Primary active dental caries extending into outer third of dentin",
    scope: "surface"
  },
  {
    code: "733940003",
    display: "Primary active dental caries extending into inner half of enamel",
    scope: "surface"
  },
  {
    code: "733939000",
    display: "Primary active dental caries extending into outer half of enamel",
    scope: "surface"
  },
  {
    code: "95254009",
    display: "Secondary dental caries",
    scope: "surface"
  },
  {
    code: "80967001",
    display: "Dental caries",
    scope: "surface"
  },
  {
    code: "109736000",
    display: "Dental restoration failure of periodontal anatomical integrity",
    scope: "surface"
  },
  {
    code: "109729001",
    display: "Overhang on tooth restoration",
    scope: "surface"
  },
  {
    code: "82212003",
    display: "Erosion of teeth",
    scope: "surface"
  },
  {
    code: "48947008",
    display: "Abnormal tooth attrition",
    scope: "surface"
  },
  {
    code: "47222000",
    display: "Abrasion of tooth",
    scope: "surface"
  },
  {
    code: "26748006",
    display: "Hypocalcification of teeth",
    scope: "surface"
  },
  {
    code: "36202009",
    display: "Fracture of tooth",
    scope: "surface"
  },

  // -------------------------
  // Whole-tooth findings
  // -------------------------

  {
    code: "367534004",
    display: "Supernumerary tooth",
    scope: "tooth"
  },
  {
    code: "278661005",
    display: "Tooth present",
    scope: "tooth"
  },
  {
    code: "235104008",
    display: "Impacted tooth",
    scope: "tooth"
  },
  {
    code: "234948008",
    display: "Tooth absent",
    scope: "tooth"
  },
  {
    code: "109674000",
    display: "Acquired absence of single tooth",
    scope: "tooth"
  },
  {
    code: "109442002",
    display: "Congenital absence of one tooth",
    scope: "tooth"
  },
  {
    code: "109671008",
    display: "Complete dislocation of tooth",
    scope: "tooth"
  },
  {
    code: "66569006",
    display: "Retained dental root",
    scope: "tooth"
  },
  {
    code: "57203004",
    display: "Disorder of pulp of tooth",
    scope: "tooth"
  },
  {
    code: "32620007",
    display: "Pulpitis",
    scope: "tooth"
  },
  {
    code: "42711005",
    display: "Necrosis of the pulp",
    scope: "tooth"
  },
  {
    code: "39273001",
    display: "Apical periodontitis",
    scope: "tooth"
  },
  {
    code: "397869004",
    display: "Dental trauma",
    scope: "tooth"
  },

  // -------------------------
  // Periodontal findings
  // -------------------------

  {
    code: "109617003",
    display: "Suppurative inflammation of subgingival space",
    scope: "periodontalSite"
  },
  {
    code: "41366005",
    display: "Subgingival dental calculus",
    scope: "periodontalSite"
  },
  {
    code: "18755003",
    display: "Supragingival dental calculus",
    scope: "periodontalSite"
  },
  {
    code: "41565005",
    display: "Periodontitis",
    scope: "periodontalSite"
  },

  // -------------------------
  // Global / non-odontogram
  // -------------------------

  {
    code: "170970005",
    display: "Prognosis uncertain",
    scope: "global"
  },
  {
    code: "170968001",
    display: "Prognosis good",
    scope: "global"
  },
  {
    code: "47944004",
    display: "Malocclusion of teeth",
    scope: "global"
  },
  {
    code: "37156001",
    display: "Disorder of jaw",
    scope: "global"
  }

];
