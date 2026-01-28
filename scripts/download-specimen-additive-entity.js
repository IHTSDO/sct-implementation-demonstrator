const https = require('https');
const fs = require('fs');
const path = require('path');

const VALUESET_JSON_URL = 'https://build.fhir.org/ig/HL7/UTG/ValueSet-v3-SpecimenAdditiveEntity.json';
const VALUESET_HTML_URL = 'https://build.fhir.org/ig/HL7/UTG/ValueSet-v3-SpecimenAdditiveEntity.html';
const OUTPUT_FILE = path.join(__dirname, '../src/assets/data/specimen-additive-entity.json');

/**
 * Download content from URL
 */
function downloadContent(url) {
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
 * Extract codes from JSON ValueSet
 */
function extractCodesFromJSON(jsonData) {
  try {
    const valueset = JSON.parse(jsonData);
    
    if (valueset.expansion && valueset.expansion.contains) {
      return valueset.expansion.contains.map(item => ({
        code: item.code || '',
        display: item.display || item.code || '',
        system: item.system || 'http://terminology.hl7.org/CodeSystem/v3-EntityCode'
      }));
    }
    
    return [];
  } catch (e) {
    return null;
  }
}

/**
 * Parse HTML and extract codes from the expansion table
 */
function parseValueSetCodesFromHTML(html) {
  const codes = [];
  
  // Extract table rows - look for the expansion table
  // The table has structure with System, Code, Display columns
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
        // Remove HTML tags and decode entities
        let cellContent = cellMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim();
        
        cells.push(cellContent);
      }
      
      // Expected format: [System, Code, Display, Definition?, ...]
      // We need at least System, Code, and Display
      if (cells.length >= 3) {
        const system = cells[0].trim();
        const code = cells[1].trim();
        const display = cells[2].trim();
        
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
    // Try JSON first
    console.log('Attempting to download JSON from:', VALUESET_JSON_URL);
    try {
      const jsonData = await downloadContent(VALUESET_JSON_URL);
      const codes = extractCodesFromJSON(jsonData);
      
      if (codes && codes.length > 0) {
        console.log(`Found ${codes.length} codes from JSON`);
        
        // Sort by display name for better UX
        codes.sort((a, b) => a.display.localeCompare(b.display));
        
        // Create output structure similar to FHIR ValueSet expansion
        const output = {
          resourceType: 'ValueSet',
          url: 'http://terminology.hl7.org/ValueSet/v3-SpecimenAdditiveEntity',
          name: 'SpecimenAdditiveEntity',
          title: 'SpecimenAdditiveEntity',
          status: 'active',
          experimental: false,
          date: new Date().toISOString(),
          description: 'Set of codes related to specimen additives',
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
        console.log(`   First 5 codes:`, codes.slice(0, 5).map(c => c.display).join(', '));
        return;
      }
    } catch (jsonError) {
      console.log('JSON download failed, trying HTML...');
    }
    
    // Fallback to HTML parsing
    console.log('Downloading HTML from:', VALUESET_HTML_URL);
    const html = await downloadContent(VALUESET_HTML_URL);
    
    console.log('Parsing HTML...');
    const codes = parseValueSetCodesFromHTML(html);
    
    if (codes.length === 0) {
      throw new Error('No codes found in HTML. The page structure may have changed.');
    }
    
    console.log(`Found ${codes.length} codes`);
    
    // Sort by display name for better UX
    codes.sort((a, b) => a.display.localeCompare(b.display));
    
    // Create output structure similar to FHIR ValueSet expansion
    const output = {
      resourceType: 'ValueSet',
      url: 'http://terminology.hl7.org/ValueSet/v3-SpecimenAdditiveEntity',
      name: 'SpecimenAdditiveEntity',
      title: 'SpecimenAdditiveEntity',
      status: 'active',
      experimental: false,
      date: new Date().toISOString(),
      description: 'Set of codes related to specimen additives',
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
    console.log(`   First 5 codes:`, codes.slice(0, 5).map(c => c.display).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
