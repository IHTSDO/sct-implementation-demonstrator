import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MenuService {

  demos = [
    { 
      name: "Clinical User Interface Demo",
      subtitle: "Clinical demo",
      type: "external", 
      url: "https://ihtsdo.github.io/snomed-ui-examples",
      description: "A simulation of clinical data entry on an EHR using SNOMED FHIR Terminology services"
    },
    { 
      name: "Allergies",
      subtitle: "Clinical demo",
      type: "internal", 
      url: "/allergies",
      description: "A SNOMED / FHIR implementation demo of recording Allergy / Intollerance details, from Allergies Clinical Reference Group"
    },
    { 
      name: "LOINC & SNOMED CT",
      subtitle: "Clinical demo",
      type: "internal", 
      url: "/loinc",
      description: "A LOINC Ontology implementation demo, covering laboratory orders, results and FHIR resources."
    },
    { 
      name: "NCPT Refset",
      subtitle: "Clinical demo",
      type: "internal", 
      url: "/ncpt",
      description: "A clinical demonstration of the NCPT (Nutrition Care Process Terminology) reference set."
    },
    { 
      name: "Implementation Maturity Framework",
      subtitle: "Tool",
      type: "internal", 
      url: "/maturity",
      description: "An online maturity assessment tool and an dashboard for compiling and analyzing collections of maturity results."
    },
    { 
      name: "Terminology Bindings Sandbox", 
      subtitle: "Learning demo",
      type: "internal", 
      url: "/sandbox",
      description: "A sandbox for learning and testing terminology bindings"
    },
    { 
      name: "SNOMED Maps Demonstrator",
      subtitle: "Learning demo",
      type: "external", 
      url: "https://ihtsdo.github.io/iid-icd-maps",
      description: "A SNOMED / ICD-10 maps demonstration, including complex map rules execution", 
    },
    { 
      name: "Post-coordination Demonstrator",
      subtitle: "Learning demo",
      type: "external", 
      url: "https://ihtsdo.github.io/iid-postcoordination",
      description: "A SNOMED post-coordination demonstration, with new prototype Postcoordination Terminology server SNOWSTORM X",
    },
    { 
      name: "IPS Terminology Demonstrator",
      subtitle: "Learning demo",
      type: "external", 
      url: "https://ihtsdo.github.io/iid-ips/",
      description: "A demonstration of the International Patient Summary (IPS) terminology, including the IPS SNOMED CT refset",
    },
    { 
      name: "SNOMED & FHIR Questionnaires Manager Application",
      subtitle: "Tool",
      type: "internal", 
      url: "/questionnaires",
      description: "An application to manage a FHIR Questionnaires repository, with SNOMED CT bindings",
    },
    { name: "SNOMED & FHIR Questionnaires Utilities",
      subtitle: "Tool",
      type: "internal", 
      url: "/questionnaires", 
      queryParams: { utility: true },
      description: "Utilities for working with FHIR Questionnaires, including SNOMED CT bindings"
    },
    { 
      name: "Context Representation Transformations",
      subtitle: "Learning demo",
      type: "internal", 
      url: "/context",
      description: "A demonstration of the transformation of context representations from SNOMED to FHIR Resources"
    },
    { 
      name: "SNOMED and LLMs (AI Demo)",
      subtitle: "Learning demo",
      type: "external", 
      url: "https://ihtsdo.github.io/openai-demo/",
      description: "This demo uses OpenAI ChatGPT API to demonstrate the use of SNOMED CT with Language Model Models (LLMs). A developer key for the OpenAI API is required."
    },
    { 
      name: "Snoguess (A SNOMED game)",
      subtitle: "Game",
      type: "internal", 
      url: "/snoguess",
      description: "A SNOMED term guessing game, learn about SNOMED content while having fun and competing to achieve the highest score"
    },
    {
      name: "SNOMED Implementation Roadmap Generator",
      subtitle: "Tool",
      type: "external",
      url: "https://ihtsdo.github.io/roadmap-generator",
      description: "A tool designed to promote and support the creation of implementation roadmaps for the adoption of SNOMED CT in countries, regions or organizations."
    },
    {
      name: "SNOMED CT as an Evolving Terminology",
      subtitle: "Learning demo",
      type: "internal",
      url: "/reports",
      description: "A collection of educational material and changes reports to understand how SNOMED changes on each realease and help plan implementations accordingly."
    },
    {
      name: "Descriptive analytics demo",
      subtitle: "Analytics demo",
      type: "internal",
      url: "/descriptive-analytics",
      description: "A demo of descriptive analytics for SNOMED CT, including a treemap visualization with nested boxes for hierarchical data exploration."
    },
    {
      name: "SNOMED EHR Lab",
      subtitle: "Clinical demo",
      type: "internal",
      url: "/ehr-lab",
      description: "A hands-on demo suite showing how to design clinical workflows that produce clean, connected, computable data—ready for safety checks, analytics, and exchange. Powered by FHIR and SNOMED CT, but framed around end-to-end information quality."
    },
    {
      name: "SNOMED Integrations Hub",
      subtitle: "Learning demo",
      type: "internal",
      url: "/snomed-integrations",
      description: "A demonstration of SNOMED CT integrations with live data. Navigate the integrations hub to explore the different integrations with other classifications, terminologies, and code systems."
    },
    {
      name: "ValueSet Utility",
      subtitle: "Tool",
      type: "internal",
      url: "/valueset-translator",
      description: "An utility for transforming SNOMED CT value sets from non-standard formats (Excel, CSV, Snap2SNOMED maps) into standards-compliant FHIR ValueSet resources and packages."
    },
    {
      name: "Analytics with Snolytical",
      subtitle: "Analytics demo",
      type: "external",
      url: "https://training-snolytical.ihtsdotools.org/",
      description: "A health data analytics demonstrator leveraging the SNOMED CT hierarchy. The demo shows how clinicians can get hand-on and engage with their SNOMED coded data directly, by building and running their own basic data-science reports. "
    },
    {
      name: "Module Dependency Reference Set Viewer",
      subtitle: "Learning demo",
      type: "internal",
      url: "/mdrs-viewer",
      description: "A graphical viewer for the Module Dependency Reference Set (MDRS) that displays dependencies between SNOMED CT modules, showing which module versions depend on which other module versions."
    }

  ];

  constructor() { }

  getDemos() {
    return this.demos;
  }
}
