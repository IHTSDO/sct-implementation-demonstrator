import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MenuService {

  demos = [
    {
      key: "encountersUiDemo",
      name: "Encounters UI Demo",
      subtitle: "clinicalDemo",
      type: "external",
      url: "https://ihtsdo.github.io/snomed-ui-examples",
      description: "A simulation of clinical data entry for clinical encounters SNOMED FHIR Terminology services. The classic SNOMED UI Demo."
    },
    {
      key: "ehrLab",
      name: "SNOMED EHR Lab",
      subtitle: "clinicalDemo",
      type: "internal",
      url: "/ehr-lab",
      description: "A complete EHR simulation with generated persistent patients, clinical, dental, and nursing records, AI-assisted entry, CDS, analytics, interoperability tools, and Smart Health Links powered by FHIR and SNOMED CT."
    },
    {
      key: "allergies",
      name: "Allergies",
      subtitle: "clinicalDemo",
      type: "internal",
      url: "/allergies",
      description: "A SNOMED / FHIR implementation demo of recording Allergy / Intolerance details, from Allergies Clinical Reference Group"
    },
    {
      key: "loincSnomed",
      name: "LOINC & SNOMED CT",
      subtitle: "clinicalDemo",
      type: "internal",
      url: "/loinc",
      description: "A LOINC Ontology implementation demo, covering laboratory orders, results and FHIR resources."
    },
    {
      key: "ncptRefset",
      name: "NCPT Refset",
      subtitle: "clinicalDemo",
      type: "internal",
      url: "/ncpt",
      description: "A clinical demonstration of the NCPT (Nutrition Care Process Terminology) reference set."
    },
    {
      key: "maturityFramework",
      name: "Implementation Maturity Framework",
      subtitle: "tool",
      type: "internal",
      url: "/maturity",
      description: "An online maturity assessment tool and a dashboard for compiling and analyzing collections of maturity results."
    },
    {
      key: "bindingsSandbox",
      name: "Terminology Bindings Sandbox",
      subtitle: "learningDemo",
      type: "internal",
      url: "/sandbox",
      description: "A sandbox for learning and testing terminology bindings"
    },
    {
      key: "snomedMaps",
      name: "SNOMED Maps Demonstrator",
      subtitle: "learningDemo",
      type: "internal",
      url: "/icd-mappings",
      description: "A SNOMED / ICD-10 maps demonstration, including complex map rules execution",
    },
    {
      key: "postcoordination",
      name: "Post-coordination Demonstrator",
      subtitle: "learningDemo",
      type: "external",
      url: "https://ihtsdo.github.io/iid-postcoordination",
      description: "A SNOMED post-coordination demonstration, with new prototype Postcoordination Terminology server SNOWSTORM X",
    },
    {
      key: "ipsTerminology",
      name: "IPS Terminology Demonstrator",
      subtitle: "learningDemo",
      type: "external",
      url: "https://ihtsdo.github.io/iid-ips/",
      description: "A demonstration of the International Patient Summary (IPS) terminology, including the IPS SNOMED CT refset",
    },
    {
      key: "questionnairesManager",
      name: "SNOMED & FHIR Questionnaires Manager Application",
      subtitle: "tool",
      type: "internal",
      url: "/questionnaires",
      description: "An application to manage a FHIR Questionnaires repository, with SNOMED CT bindings",
    },
    {
      key: "questionnairesUtilities",
      name: "SNOMED & FHIR Questionnaires Utilities",
      subtitle: "tool",
      type: "internal",
      url: "/questionnaires",
      queryParams: { utility: true },
      description: "Utilities for working with FHIR Questionnaires, including SNOMED CT bindings"
    },
    {
      key: "contextTransformations",
      name: "Context Representation Transformations",
      subtitle: "learningDemo",
      type: "internal",
      url: "/context",
      description: "A demonstration of the transformation of context representations from SNOMED to FHIR Resources"
    },
    {
      key: "snomedLlms",
      name: "SNOMED and LLMs (AI Demo)",
      subtitle: "learningDemo",
      type: "external",
      url: "https://ihtsdo.github.io/openai-demo/",
      description: "This demo uses OpenAI ChatGPT API to demonstrate the use of SNOMED CT with Language Model Models (LLMs). A developer key for the OpenAI API is required."
    },
    {
      key: "snoguess",
      name: "Snoguess (A SNOMED game)",
      subtitle: "game",
      type: "internal",
      url: "/snoguess",
      description: "A SNOMED term guessing game, learn about SNOMED content while having fun and competing to achieve the highest score"
    },
    {
      key: "roadmapGenerator",
      name: "SNOMED Implementation Roadmap Generator",
      subtitle: "tool",
      type: "external",
      url: "https://ihtsdo.github.io/roadmap-generator",
      description: "A tool designed to promote and support the creation of implementation roadmaps for the adoption of SNOMED CT in countries, regions or organizations."
    },
    {
      key: "evolvingTerminology",
      name: "SNOMED CT as an Evolving Terminology",
      subtitle: "learningDemo",
      type: "internal",
      url: "/reports",
      description: "A collection of educational material and changes reports to understand how SNOMED changes on each release and help plan implementations accordingly."
    },
    {
      key: "descriptiveAnalytics",
      name: "Descriptive analytics demo",
      subtitle: "analyticsDemo",
      type: "internal",
      url: "/descriptive-analytics",
      description: "A demo of descriptive analytics for SNOMED CT, including a treemap visualization with nested boxes for hierarchical data exploration."
    },
    {
      key: "integrationsHub",
      name: "SNOMED Integrations Hub",
      subtitle: "learningDemo",
      type: "internal",
      url: "/snomed-integrations",
      description: "A demonstration of SNOMED CT integrations with live data. Navigate the integrations hub to explore the different integrations with other classifications, terminologies, and code systems."
    },
    {
      key: "valueSetUtility",
      name: "ValueSet Utility",
      subtitle: "tool",
      type: "internal",
      url: "/valueset-translator",
      description: "A utility for transforming SNOMED CT value sets from non-standard formats (Excel, CSV, Snap2SNOMED maps) into standards-compliant FHIR ValueSet resources and packages."
    },
    {
      key: "extensionsSearch",
      name: "Extensions Search Utility",
      subtitle: "tool",
      type: "internal",
      url: "/extensions-search",
      description: "A utility for running ECL searches across the latest SNOMED CT extensions and comparing concept matches by edition."
    },
    {
      key: "snolytical",
      name: "Analytics with Snolytical",
      subtitle: "analyticsDemo",
      type: "external",
      url: "https://training-snolytical.ihtsdotools.org/",
      description: "A health data analytics demonstrator leveraging the SNOMED CT hierarchy. The demo shows how clinicians can get hands-on and engage with their SNOMED coded data directly, by building and running their own basic data-science reports."
    },
    {
      key: "mdrsViewer",
      name: "Module Dependency Reference Set Viewer",
      subtitle: "learningDemo",
      type: "internal",
      url: "/mdrs-viewer",
      description: "A graphical viewer for the Module Dependency Reference Set (MDRS) that displays dependencies between SNOMED CT modules, showing which module versions depend on which other module versions."
    },
    {
      key: "drugStrengthRounding",
      name: "Drug Strength Rounding Rules",
      subtitle: "learningDemo",
      type: "internal",
      url: "/drug-strength-rounding",
      description: "A demonstration of drug strength rounding rules for significant figures in pharmaceutical calculations"
    },
    {
      key: "medicinalProductClasses",
      name: "Medicinal Product Classes",
      subtitle: "learningDemo",
      type: "internal",
      url: "/medicinal-product-classes",
      description: "A terminology bindings demonstrator for medicinal product, clinical drug, and packaged clinical drug classes using reusable coding spec tabs."
    },
    {
      key: "fhirInternationalizer",
      name: "FHIR Resource Internationalizer",
      subtitle: "tool",
      type: "internal",
      url: "/fhir-internationalizer",
      description: "Upload a FHIR resource, replace extension codings with their closest International Edition ancestors, adapt concept displays to the language and terminology of your target edition, and find historical replacements for any inactive concepts."
    }

  ];

  constructor() { }

  getDemos() {
    return this.demos;
  }
}
