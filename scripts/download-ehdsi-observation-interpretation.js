const https = require('https');
const fs = require('fs');
const path = require('path');

const VALUESET_URL = 'https://fhir.ehdsi.eu/laboratory/ValueSet-eHDSIObservationInterpretationWithExceptions.html';
const OUTPUT_FILE = path.join(__dirname, '../src/assets/data/ehdsi-observation-interpretation-with-exceptions.json');

/**
 * Download HTML content from URL
 */
function downloadHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse HTML and extract codes from the expansion table
 * Based on the ValueSet specification, we'll extract codes and use display mappings
 */
function parseValueSetCodes(html) {
  const codes = [];
  
  // Mapping of codes to display names (from the ValueSet specification table)
  const displayMap = {
    'OTH': 'Other',
    'UNC': 'Unencoded',
    'UNK': 'Unknown',
    '<': 'Below detection limit',
    '>': 'Above detection limit',
    'A': 'Abnormal',
    'AA': 'Critical Abnormal',
    'B': 'Better',
    'CAR': 'Carrier',
    'D': 'Significant change down',
    'DET': 'Detected',
    'E': 'Equivocal',
    'EX': 'Excluded',
    'EXP': 'Expected',
    'H': 'High',
    'HH': 'Critical High',
    'HU': 'Significantly high',
    'HX': 'High - excluded',
    'I': 'Intermediate',
    'IE': 'Insufficient evidence',
    'IND': 'Indeterminate',
    'L': 'Low',
    'LL': 'Critical Low',
    'LU': 'Significantly low',
    'LX': 'Low - excluded',
    'N': 'Normal',
    'NCL': 'No CLSI breakpoint',
    'ND': 'Not Detected',
    'NEG': 'Negative',
    'NR': 'Non-reactive',
    'NS': 'Non-susceptible',
    'POS': 'Positive',
    'R': 'Resistant',
    'RR': 'Reactive',
    'S': 'Susceptible',
    'U': 'Significant change up',
    'UNE': 'Unexpected',
    'W': 'Worse',
    'WR': 'Weakly reactive',
    'SYN-R': 'Synergy - resistant',
    'SDD': 'Susceptible-dose dependent',
    'SYN-S': 'Synergy - susceptible'
  };
  
  // Extract table rows - look for the expansion table
  const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
  const tables = html.match(tableRegex) || [];
  
  for (const table of tables) {
    // Check if this table contains codes (has "terminology.hl7.org" in it)
    if (!table.includes('terminology.hl7.org')) {
      continue;
    }
    
    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    let isHeader = true;
    
    while ((match = rowRegex.exec(table)) !== null) {
      const row = match[1];
      
      // Skip header row
      if (isHeader) {
        isHeader = false;
        continue;
      }
      
      // Extract cells
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        cells.push(cellMatch[1]);
      }
      
      if (cells.length < 2) {
        continue;
      }
      
      // Extract code from first column (usually in a link like <a href="...">CODE</a>)
      let code = '';
      const codeLinkMatch = cells[0].match(/<a[^>]*>([^<\[\]]+)<\/a>/i);
      if (codeLinkMatch) {
        code = codeLinkMatch[1].trim();
      } else {
        // Fallback: extract text content
        code = cells[0]
          .replace(/<[^>]+>/g, '')
          .replace(/\[|\]/g, '')
          .trim();
      }
      
      // Extract system from second column
      let system = '';
      if (cells.length > 1) {
        system = cells[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim();
      }
      
      // Only process if we have valid code and system
      if (code && system) {
        // Determine system based on code or explicit system value
        let finalSystem = system;
        if (!finalSystem || finalSystem.length === 0) {
          // Infer system from code patterns or URL in first cell
          if (cells[0].includes('NullFlavor')) {
            finalSystem = 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor';
          } else if (cells[0].includes('ObservationInterpretation')) {
            finalSystem = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';
          }
        }
        
        // Get display from mapping
        const display = displayMap[code] || code;
        
        codes.push({
          code: code,
          display: display,
          system: finalSystem
        });
      }
    }
    
    // If we found codes in this table, break (we only need the expansion table)
    if (codes.length > 0) {
      break;
    }
  }
  
  return codes;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Downloading eHDSI Observation Interpretation with exceptions from:', VALUESET_URL);
    const html = await downloadHTML(VALUESET_URL);
    
    console.log('Parsing HTML...');
    const codes = parseValueSetCodes(html);
    
    if (codes.length === 0) {
      throw new Error('No codes found in HTML. The page structure may have changed.');
    }
    
    console.log(`Found ${codes.length} codes`);
    
    // Sort by display name for better UX
    codes.sort((a, b) => a.display.localeCompare(b.display));
    
    // Create output structure similar to FHIR ValueSet expansion
    const output = {
      resourceType: 'ValueSet',
      url: 'http://fhir.ehdsi.eu/laboratory/ValueSet/eHDSIObservationInterpretationWithExceptions',
      name: 'EHDSIObservationInterpretationWithExceptions',
      title: 'eHDSI Observation Interpretation with exceptions',
      status: 'draft',
      experimental: true,
      date: new Date().toISOString(),
      description: 'This Value Set is used for a rough qualitative interpretation of the Laboratory Observation Results. It also includes exceptional values.',
      expansion: {
        timestamp: new Date().toISOString(),
        contains: codes.map(code => ({
          system: code.system,
          code: code.code,
          display: code.display
        }))
      }
    };
    
    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    
    console.log(`✅ Successfully saved ${codes.length} codes to: ${OUTPUT_FILE}`);
    console.log(`   First 5 codes:`, codes.slice(0, 5).map(c => `${c.code}: ${c.display}`).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
