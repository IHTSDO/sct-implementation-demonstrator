const fs = require('fs');
const path = require('path');
const https = require('https');

// One-off migration: adds a bodySiteCode (clinical-record anchor point) to every descendant
// in src/assets/patients/patient-generation-spec.json, using SNOMED CT ancestors from Snowstorm Lite.
// Usage: node scripts/add-body-site-code-to-descendants.js
// The lookup cache and the pre-migration backup are written to tmp/ (git-ignored).

// Configuration
const SNOWSTORM_BASE = 'https://implementation-demo.snomedtools.org/snowstorm-lite/fhir';
const FHIR_URL_PARAM = 'http://snomed.info/sct';
const RATE_LIMIT_MS = 1000; // 1 second between requests
const ROOT_DIR = path.join(__dirname, '..');
const TMP_DIR = path.join(ROOT_DIR, 'tmp');
const CACHE_FILE = path.join(TMP_DIR, 'location-cache.json');
const BACKUP_FILE = path.join(TMP_DIR, 'patient-generation-spec.backup.json');

// Anchor points from the clinical-record component
const anchorPoints = [
  {
    id: 'head',
    ancestors: ['406122000', '118690002', '384821006']
  },
  {
    id: 'neck',
    ancestors: ['298378000', '118693000']
  },
  {
    id: 'thorax',
    ancestors: ['298705000', '118695007', '106048009', '106063007', '118669005']
  },
  {
    id: 'abdomen',
    ancestors: ['609624008', '118698009', '386617003']
  },
  {
    id: 'pelvis',
    ancestors: ['609625009', '609637006']
  },
  {
    id: 'arms',
    ancestors: ['116307009', '118702008']
  },
  {
    id: 'legs',
    ancestors: ['116312005', '118710009']
  }
];

// Load the cache if it exists
let locationCache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    locationCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`✅ Cache loaded: ${Object.keys(locationCache).length} codes`);
  } catch (error) {
    console.log('⚠️  Error loading cache, starting from scratch');
  }
}

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Extracts the concept ID from a SNOMED string (handles the "id |display|" format)
const extractConceptId = (snomedString) => {
  if (snomedString.includes(' ')) {
    return snomedString.split(' ')[0].trim();
  }
  return snomedString.trim();
};

// Gets the ancestors of a SNOMED concept
const getAncestors = (conceptId) => {
  return new Promise((resolve, reject) => {
    const ecl = `> ${conceptId}`;
    const url = `${SNOWSTORM_BASE}/ValueSet/$expand?url=${encodeURIComponent(FHIR_URL_PARAM)}?fhir_vs=ecl/${encodeURIComponent(ecl)}&count=1000&offset=0&language=en&displayLanguage=en`;
    
    https.get(url, {
      headers: {
        'Accept-Language': 'en'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Error parsing response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
};

// Extracts concept IDs from an expansion response
const extractConceptIdsFromExpansion = (response) => {
  const conceptIds = [];
  
  if (response?.expansion?.contains) {
    response.expansion.contains.forEach((concept) => {
      if (concept.code) {
        conceptIds.push(concept.code);
      }
    });
  }
  
  return conceptIds;
};

// Finds the best anchor point based on ancestors
const findBestAnchorPointForAncestors = (ancestorIds) => {
  for (const anchorPoint of anchorPoints) {
    const anchorPointConceptIds = anchorPoint.ancestors.map(ancestor => extractConceptId(ancestor));
    const hasMatch = anchorPointConceptIds.some(ancestorId => ancestorIds.includes(ancestorId));
    
    if (hasMatch) {
      return anchorPoint;
    }
  }
  
  return null;
};

// Computes the location of a SNOMED code
const calculateLocation = async (conceptId) => {
  // Check the cache first
  if (locationCache[conceptId]) {
    return locationCache[conceptId];
  }
  
  try {
    const response = await getAncestors(conceptId);
    const ancestorIds = extractConceptIdsFromExpansion(response);
    const bestAnchorPoint = findBestAnchorPointForAncestors(ancestorIds);
    
    const location = bestAnchorPoint ? bestAnchorPoint.id : 'systemic';
    
    // Store in cache
    locationCache[conceptId] = location;
    
    return location;
  } catch (error) {
    console.error(`  ⚠️  Error getting ancestors for ${conceptId}: ${error.message}`);
    const location = 'systemic';
    locationCache[conceptId] = location; // Cache the fallback too
    return location;
  }
};

// Main
const main = async () => {
  console.log('🚀 Adding bodySiteCode to descendants...\n');
  
  // Load JSON
  const jsonPath = path.join(ROOT_DIR, 'src/assets/patients/patient-generation-spec.json');
  console.log(`📖 Reading file: ${jsonPath}`);
  
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // Create backup
  fs.mkdirSync(TMP_DIR, { recursive: true });
  console.log(`💾 Creating backup: ${BACKUP_FILE}`);
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(jsonData, null, 2));
  
  // Collect all unique codes from descendants
  const uniqueCodes = new Set();
  
  jsonData.diseasePrevalenceByAgeAndSex.forEach(ageGroup => {
    ageGroup.male.forEach(diagnosis => {
      if (diagnosis.snomed?.descendants) {
        diagnosis.snomed.descendants.forEach(descendant => {
          if (descendant.code) {
            uniqueCodes.add(descendant.code);
          }
        });
      }
    });
    
    ageGroup.female.forEach(diagnosis => {
      if (diagnosis.snomed?.descendants) {
        diagnosis.snomed.descendants.forEach(descendant => {
          if (descendant.code) {
            uniqueCodes.add(descendant.code);
          }
        });
      }
    });
  });
  
  console.log(`\n📊 Unique codes found: ${uniqueCodes.size}`);
  console.log(`📊 Codes already cached: ${Array.from(uniqueCodes).filter(code => locationCache[code]).length}`);
  console.log(`📊 Codes to process: ${Array.from(uniqueCodes).filter(code => !locationCache[code]).length}\n`);
  
  // Process each unique code
  const codesArray = Array.from(uniqueCodes);
  let processed = 0;
  let skipped = 0;
  
  for (const code of codesArray) {
    if (locationCache[code]) {
      skipped++;
      continue;
    }
    
    processed++;
    console.log(`[${processed}/${codesArray.length - skipped}] Processing code: ${code}`);
    
    const location = await calculateLocation(code);
    console.log(`  ✅ Location: ${location}`);
    
    // Save the cache periodically (every 10 codes)
    if (processed % 10 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(locationCache, null, 2));
      console.log(`  💾 Cache saved (${Object.keys(locationCache).length} codes)`);
    }
    
    // Rate limiting: wait 1 second before the next request
    if (processed < codesArray.length - skipped) {
      await delay(RATE_LIMIT_MS);
    }
  }
  
  // Save the final cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(locationCache, null, 2));
  console.log(`\n💾 Final cache saved: ${Object.keys(locationCache).length} codes`);
  
  // Update JSON with bodySiteCode
  console.log('\n🔄 Updating JSON with bodySiteCode...');
  
  let updatedCount = 0;
  
  jsonData.diseasePrevalenceByAgeAndSex.forEach(ageGroup => {
    ageGroup.male.forEach(diagnosis => {
      if (diagnosis.snomed?.descendants) {
        diagnosis.snomed.descendants.forEach(descendant => {
          if (descendant.code && !descendant.bodySiteCode) {
            descendant.bodySiteCode = locationCache[descendant.code] || 'systemic';
            updatedCount++;
          }
        });
      }
    });
    
    ageGroup.female.forEach(diagnosis => {
      if (diagnosis.snomed?.descendants) {
        diagnosis.snomed.descendants.forEach(descendant => {
          if (descendant.code && !descendant.bodySiteCode) {
            descendant.bodySiteCode = locationCache[descendant.code] || 'systemic';
            updatedCount++;
          }
        });
      }
    });
  });
  
  console.log(`✅ ${updatedCount} descendants updated`);
  
  // Validate JSON
  try {
    JSON.parse(JSON.stringify(jsonData));
    console.log('✅ Valid JSON');
  } catch (error) {
    console.error('❌ Error: invalid JSON after update');
    process.exit(1);
  }
  
  // Save the updated JSON
  console.log(`\n💾 Saving updated file...`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  
  console.log('\n✅ Done!');
  console.log(`📁 Backup saved to: ${BACKUP_FILE}`);
  console.log(`💾 Cache saved to: ${CACHE_FILE}`);
};

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

