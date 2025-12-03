const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuración
const SNOWSTORM_BASE = 'https://implementation-demo.snomedtools.org/snowstorm-lite/fhir';
const FHIR_URL_PARAM = 'http://snomed.info/sct';
const RATE_LIMIT_MS = 1000; // 1 segundo entre llamadas
const CACHE_FILE = 'location-cache.json';
const BACKUP_FILE = 'patient-generation-spec.backup.json';

// Anchor points del clinical-record component
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

// Cargar cache si existe
let locationCache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    locationCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`✅ Cache cargado: ${Object.keys(locationCache).length} códigos`);
  } catch (error) {
    console.log('⚠️  Error cargando cache, empezando desde cero');
  }
}

// Función para hacer delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para extraer concept ID de string SNOMED (maneja formato con display)
const extractConceptId = (snomedString) => {
  if (snomedString.includes(' ')) {
    return snomedString.split(' ')[0].trim();
  }
  return snomedString.trim();
};

// Función para obtener ancestors de un concepto SNOMED
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

// Función para extraer concept IDs de la respuesta de expansión
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

// Función para encontrar el mejor anchor point basado en ancestors
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

// Función para calcular location de un código SNOMED
const calculateLocation = async (conceptId) => {
  // Verificar cache primero
  if (locationCache[conceptId]) {
    return locationCache[conceptId];
  }
  
  try {
    const response = await getAncestors(conceptId);
    const ancestorIds = extractConceptIdsFromExpansion(response);
    const bestAnchorPoint = findBestAnchorPointForAncestors(ancestorIds);
    
    const location = bestAnchorPoint ? bestAnchorPoint.id : 'systemic';
    
    // Guardar en cache
    locationCache[conceptId] = location;
    
    return location;
  } catch (error) {
    console.error(`  ⚠️  Error obteniendo ancestors para ${conceptId}: ${error.message}`);
    const location = 'systemic';
    locationCache[conceptId] = location; // Cachear el fallback también
    return location;
  }
};

// Función principal
const main = async () => {
  console.log('🚀 Iniciando proceso de agregar computedLocation a descendants...\n');
  
  // Cargar JSON
  const jsonPath = path.join(__dirname, 'src/assets/patients/patient-generation-spec.json');
  console.log(`📖 Leyendo archivo: ${jsonPath}`);
  
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // Crear backup
  console.log(`💾 Creando backup: ${BACKUP_FILE}`);
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(jsonData, null, 2));
  
  // Extraer todos los códigos únicos de descendants
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
  
  console.log(`\n📊 Total de códigos únicos encontrados: ${uniqueCodes.size}`);
  console.log(`📊 Códigos ya en cache: ${Array.from(uniqueCodes).filter(code => locationCache[code]).length}`);
  console.log(`📊 Códigos a procesar: ${Array.from(uniqueCodes).filter(code => !locationCache[code]).length}\n`);
  
  // Procesar cada código único
  const codesArray = Array.from(uniqueCodes);
  let processed = 0;
  let skipped = 0;
  
  for (const code of codesArray) {
    if (locationCache[code]) {
      skipped++;
      continue;
    }
    
    processed++;
    console.log(`[${processed}/${codesArray.length - skipped}] Procesando código: ${code}`);
    
    const location = await calculateLocation(code);
    console.log(`  ✅ Location: ${location}`);
    
    // Guardar cache periódicamente (cada 10 códigos)
    if (processed % 10 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(locationCache, null, 2));
      console.log(`  💾 Cache guardado (${Object.keys(locationCache).length} códigos)`);
    }
    
    // Rate limiting: esperar 1 segundo antes de la siguiente llamada
    if (processed < codesArray.length - skipped) {
      await delay(RATE_LIMIT_MS);
    }
  }
  
  // Guardar cache final
  fs.writeFileSync(CACHE_FILE, JSON.stringify(locationCache, null, 2));
  console.log(`\n💾 Cache final guardado: ${Object.keys(locationCache).length} códigos`);
  
  // Actualizar JSON con computedLocation
  console.log('\n🔄 Actualizando JSON con computedLocation...');
  
  let updatedCount = 0;
  
  jsonData.diseasePrevalenceByAgeAndSex.forEach(ageGroup => {
    ageGroup.male.forEach(diagnosis => {
      if (diagnosis.snomed?.descendants) {
        diagnosis.snomed.descendants.forEach(descendant => {
          if (descendant.code && !descendant.computedLocation) {
            descendant.computedLocation = locationCache[descendant.code] || 'systemic';
            updatedCount++;
          }
        });
      }
    });
    
    ageGroup.female.forEach(diagnosis => {
      if (diagnosis.snomed?.descendants) {
        diagnosis.snomed.descendants.forEach(descendant => {
          if (descendant.code && !descendant.computedLocation) {
            descendant.computedLocation = locationCache[descendant.code] || 'systemic';
            updatedCount++;
          }
        });
      }
    });
  });
  
  console.log(`✅ ${updatedCount} descendants actualizados`);
  
  // Validar JSON
  try {
    JSON.parse(JSON.stringify(jsonData));
    console.log('✅ JSON válido');
  } catch (error) {
    console.error('❌ Error: JSON inválido después de actualizar');
    process.exit(1);
  }
  
  // Guardar JSON actualizado
  console.log(`\n💾 Guardando archivo actualizado...`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  
  console.log('\n✅ ¡Proceso completado exitosamente!');
  console.log(`📁 Backup guardado en: ${BACKUP_FILE}`);
  console.log(`💾 Cache guardado en: ${CACHE_FILE}`);
};

// Ejecutar
main().catch(error => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

