import { Component, OnInit } from '@angular/core';

interface MaturityResponse {
  [goalIndex: string]: {
    components: {
      [componentName: string]: {
        [metricName: string]: string; // Assuming the response is a string corresponding to the value of the radio button
      };
    };
  };
}

@Component({
  selector: 'app-maturity-main',
  templateUrl: './maturity-main.component.html',
  styleUrl: './maturity-main.component.css'
})
export class MaturityMainComponent implements OnInit {

  maturityQuestions = [
    {
      goal: "Adoption",
      components: [
        {
          component: "Roadmap",
          metrics: [
            {
              metric: "Explicit plan",
              question: "Have you documented a plan for your implementation activities for the next 5 years?",
              label1: "No, a plan is not documented",
              label5: "Yes, a detailed plan is documented",
              response: 0
            },
            {
              metric: "Resources",
              question: "Have you established a team with the required skills and competencies to implement the plan?",
              label1: "No, a team is not established",
              label5: "Yes, a team is fully established and sufficient for the implementation",
              response: 0
            },
            {
              metric: "Training",
              question: "Have you designed a training a trainign strategy for team members, users, vendors, decision makers, etc.?",
              label1: "No, a training strategy is not designed",
              label5: "Yes, a detailed training strategy is designed",
              response: 0
            },
            {
              metric: "Sustainability",
              question: "Have you identified the resources needed to sustain the implementation of the plan?",
              label1: "No, resources are not identified",
              label5: "Yes, resources are identified and secured",
              response: 0
            },
            {
              metric: "National Terminology Server",
              question: "Do you have a defined clinical terminology servers strategy?",
              label1: "No, a strategy is not defined, a technology has not been selected",
              label5: "Yes, a strategy is defined, the server is operational and in use",
              response: 0
            }
          ]
        },
        {
          component: "Usage",
          metrics: [
            {
              metric: "Facilities",
              question: "What percentage of all the clinics or hospitals in your country are using SNOMED CT in production?",
              label1: "0 to 20%",
              label5: "81 to 100%",
              response: 0
            },
            {
              metric: "Systems",
              question: "What percentage of all the EHR or other clinical systems in your country are using SNOMED CT in production?",
              label1: "0 to 20%",
              label5: "81 to 100%",
              response: 0
            },
            {
              metric: "Population",
              question: "What percentage of the population in your country is covered by EHR systems using SNOMED CT?",
              label1: "0 to 20%",
              label5: "81 to 100%",
              response: 0
            },
            {
              metric: "Content scope",
              question: "From the following list of basic SNOMED hierarchies, how many are used in the EHR systems in your country?<br>1. Clinical finding<br>2. Procedure<br>3. Body structure<br>4. Substance<br>5. Pharmaceutical products",
              label1: "1 hierarchy",
              label5: "All 5 hierarchies",
              response: 0
            },
            {
              metric: "Clinical care levels",
              question: "From the following list of clinical care levels, how many are covered by the EHR systems in your country?<br>1. Primary care<br>2. Secondary care<br>3. Tertiary care<br>4. Long-term care<br>5. Home care",
              label1: "1 care level",
              label5: "All 5 care levels",
              response: 0
            },
          ]
        }
      ]
    },
    {
      goal: "Customization",
      components: [
        {
          component: "Local extensions",
          metrics: [
            {
              metric: "Maps",
              question: "Do you have the maps that are required to meet your strategy goals?",
              label1: "No, maps are not available",
              label5: "Yes, all necessary maps are available and in use",
              response: 0
            },
            {
              metric: "Subsets",
              question: "Do you have the subsets that are required to meet your strategy goals?",
              label1: "No, subsets are not available",
              label5: "Yes, all necessary subsets are available and in use",
              response: 0
            },
            {
              metric: "Clinical concepts",
              question: "Do you have the clinical concepts that are required to meet your strategy goals?",
              label1: "No, clinical concepts are not available",
              label5: "Yes, There are no outstanding content requirements. They may have been met by the International Edition or already developed in the national Edition",
              response: 0
            },
            {
              metric: "Language",
              question: "Are the local terms that are required to support your goals available in your edition? This may include additional synonyms or patient friendly terms.",
              label1: "No, local terms are not available",
              label5: "Yes, all necessary local terms are available and in use",
              response: 0
            },
            {
              metric: "Translation",
              question: "Do you have the translations that are required to meet your strategy goals?",
              label1: "No, translations are not available",
              label5: "Yes, all necessary translations are available and in use",
              response: 0
            }
          ]
        }
      ]
    }
  ];

  constructor() { }

  ngOnInit() {
  }

  onNext() {
    // Process responses, navigate, or prepare data for the next component
    console.log(this.maturityQuestions);
  }

} 
