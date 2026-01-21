const https = require('https');
const fs = require('fs');
const path = require('path');

const VALUESET_URL = 'https://fhir.ehdsi.eu/laboratory/ValueSet-eHDSILabTechniqueWithExceptions.html';
const OUTPUT_FILE = path.join(__dirname, '../src/assets/data/ehdsi-lab-technique-with-exceptions.json');

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
 */
function parseValueSetCodes(html) {
  const codes = [];
  
  // Extract table rows - look for the expansion table
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables = html.match(tableRegex) || [];
  
  for (const table of tables) {
    // Check if this table contains codes (has "snomed.info" or "terminology.hl7.org" in it)
    if (!table.includes('snomed.info') && !table.includes('terminology.hl7.org')) {
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
        // Remove HTML tags and decode entities
        let cellContent = cellMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        
        cells.push(cellContent);
      }
      
      // Expected format: [Code, System, Display, Definition?]
      if (cells.length >= 3) {
        const code = cells[0].trim();
        const system = cells[1].trim();
        let display = cells[2].trim();
        
        // Simplify NullFlavor displays
        if (system === 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor') {
          if (code === 'OTH') {
            display = 'Other';
          } else if (code === 'UNC') {
            display = 'Unencoded';
          } else if (code === 'UNK') {
            display = 'Unknown';
          }
        }
        
        // Only process if we have valid code, system, and display
        if (code && system && display) {
          codes.push({
            code: code,
            display: display,
            system: system
          });
        }
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
    console.log('Downloading eHDSI Laboratory Technique with exceptions from:', VALUESET_URL);
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
      url: 'http://fhir.ehdsi.eu/laboratory/ValueSet/eHDSILabTechniqueWithExceptions',
      name: 'EHDSILabTechniqueWithExceptions',
      title: 'eHDSI Laboratory Technique with exceptions',
      status: 'draft',
      experimental: true,
      date: new Date().toISOString(),
      description: 'The Value Set is used to code laboratory techniques for result measurements and includes exceptional values. It is defined as the union of: (a) eHDSI Laboratory Technique (b) eHDSI Exceptional Value',
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
    console.log(`   Codes:`, codes.map(c => `${c.code} - ${c.display}`).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
