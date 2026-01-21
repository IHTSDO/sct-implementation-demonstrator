const https = require('https');
const fs = require('fs');
const path = require('path');

const UCUM_URL = 'https://build.fhir.org/valueset-ucum-units.html';
const OUTPUT_FILE = path.join(__dirname, '../src/assets/ucum-units.json');

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
 * Parse HTML and extract UCUM units from the table
 */
function parseUCUMUnits(html) {
  const units = [];
  
  // Extract table rows - look for the expansion table
  // The table has structure: <tr><td>System</td><td>Code</td><td>Display</td></tr>
  const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
  const tables = html.match(tableRegex) || [];
  
  for (const table of tables) {
    // Check if this table contains UCUM units (has "unitsofmeasure.org" in it)
    if (!table.includes('unitsofmeasure.org')) {
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
          .trim();
        
        cells.push(cellContent);
      }
      
      // Expected format: [System, Code, Display]
      if (cells.length >= 3) {
        const system = cells[0].trim();
        const code = cells[1].trim();
        const display = cells[2].trim();
        
        // Only process if it's from unitsofmeasure.org
        if (system === 'http://unitsofmeasure.org' && code && display) {
          units.push({
            code: code,
            display: display,
            system: system
          });
        }
      }
    }
    
    // If we found units in this table, break (we only need the expansion table)
    if (units.length > 0) {
      break;
    }
  }
  
  return units;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Downloading UCUM units from:', UCUM_URL);
    const html = await downloadHTML(UCUM_URL);
    
    console.log('Parsing HTML...');
    const units = parseUCUMUnits(html);
    
    if (units.length === 0) {
      throw new Error('No UCUM units found in HTML. The page structure may have changed.');
    }
    
    console.log(`Found ${units.length} UCUM units`);
    
    // Sort by display name for better UX
    units.sort((a, b) => a.display.localeCompare(b.display));
    
    // Create output structure similar to FHIR ValueSet expansion
    const output = {
      resourceType: 'ValueSet',
      url: 'http://hl7.org/fhir/ValueSet/ucum-units',
      name: 'UCUMCodes',
      title: 'UCUM Codes',
      status: 'draft',
      experimental: true,
      date: new Date().toISOString(),
      description: 'Unified Code for Units of Measure (UCUM). This value set includes all UCUM codes',
      expansion: {
        timestamp: new Date().toISOString(),
        contains: units.map(unit => ({
          system: unit.system,
          code: unit.code,
          display: unit.display
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
    
    console.log(`✅ Successfully saved ${units.length} UCUM units to: ${OUTPUT_FILE}`);
    console.log(`   First 5 units:`, units.slice(0, 5).map(u => u.display).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
