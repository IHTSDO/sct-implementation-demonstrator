import { Component, Input, OnChanges, SimpleChanges, EventEmitter, Output, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { TerminologyService } from '../../services/terminology.service';

declare var window: any;

@Component({
  selector: 'app-openehr-form',
  templateUrl: './openehr-form.component.html',
  styleUrls: ['./openehr-form.component.css'],
  standalone: false
})
export class OpenehrFormComponent implements OnChanges, AfterViewInit {
  @Input() webTemplate: any = null;
  @Input() composition: any = null; // Optional: existing composition to import
  @Input() templateId: string = '';
  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCancelled = new EventEmitter<void>();

  formRendered = false;
  formContainerId = '';
  private medblocksLoaded = false;
  private formElement: any = null;
  private viewInitialized = false;
  private formDataCache: any = {}; // Cache to store form data as user types

  @ViewChild('formContainer', { static: false }) formContainerRef!: ElementRef;

  constructor(
    private cdr: ChangeDetectorRef,
    private terminologyService: TerminologyService
  ) {
    // Generate unique container ID for this component instance
    this.formContainerId = `openehr-form-${Math.random().toString(36).substr(2, 9)}`;
    // Load Medblocks UI library if not already loaded
    this.loadMedblocksLibrary();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['webTemplate'] && this.webTemplate && this.viewInitialized) {
      setTimeout(() => this.renderForm(), 300);
    }
    if (changes['composition'] && this.composition && this.formRendered) {
      setTimeout(() => this.importComposition(), 300);
    }
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (this.webTemplate) {
      setTimeout(() => this.renderForm(), 300);
    }
  }

  private loadMedblocksLibrary(): void {
    // Check if Medblocks UI is already loaded
    if (window.MedblocksUI || document.querySelector('script[src*="medblocks-ui"]')) {
      this.medblocksLoaded = true;
      this.loadShoelaceCSS();
      return;
    }

    // Load Medblocks UI bundle dynamically
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/medblocks-ui@0.0.211/dist/bundle.js';
    script.onload = () => {
      this.medblocksLoaded = true;
      this.loadShoelaceCSS();
      // Re-render if webTemplate is already available
      if (this.webTemplate) {
        setTimeout(() => this.renderForm(), 300);
      }
    };
    script.onerror = () => {
      console.error('Failed to load Medblocks UI library');
    };
    document.head.appendChild(script);
  }

  private loadShoelaceCSS(): void {
    // Check if Shoelace CSS is already loaded
    if (document.querySelector('link[href*="shoelace"]')) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.0.0-beta.71/dist/themes/light.min.css';
    document.head.appendChild(link);
  }

  renderForm(): void {
    if (!this.webTemplate) {
      this.formRendered = false;
      return;
    }

    if (!this.medblocksLoaded) {
      this.formRendered = false;
      return;
    }

    try {
      // Check if container exists
      const container = this.formContainerRef?.nativeElement;
      if (!container) {
        this.formRendered = false;
        return;
      }
      
      // Clear any existing form first
      container.innerHTML = '';
      
      // Create mb-auto-form element
      setTimeout(() => {
        try {
          const formElement = document.createElement('mb-auto-form');
          formElement.id = this.formContainerId;
          
          // Store reference to the form element
          this.formElement = formElement;
          
          container.appendChild(formElement);
          
          // Wait for custom element to be defined and initialized
          // Use requestAnimationFrame and multiple checks to ensure element is ready
          const checkAndSetTemplate = (attempts: number = 0) => {
            if (attempts > 10) {
              console.error('Failed to initialize mb-auto-form after multiple attempts');
              this.formRendered = false;
              this.cdr.detectChanges();
              return;
            }
            
            // Check if custom element is defined
            if (formElement) {
              // Set webTemplate property
              try {
                (formElement as any).webTemplate = this.webTemplate;
                
                // Configure terminology server for Medblocks UI
                // Medblocks UI can use a FHIR Terminology Service
                // We'll configure it to use Snowstorm (the same one TerminologyService uses)
                if ((formElement as any).terminologyServer !== undefined) {
                  (formElement as any).terminologyServer = this.terminologyService.snowstormFhirBase;
                }
                
                // Also try setting it as a property if Medblocks UI supports it
                if ((formElement as any).setAttribute) {
                  (formElement as any).setAttribute('terminology-server', this.terminologyService.snowstormFhirBase);
                }
                
                // Add error handler for terminology search errors
                // Also set up global error handler to catch unhandled errors from Medblocks UI
                const errorHandler = (event: any): void => {
                  // Silently handle terminology search errors - these are expected
                  // when no terminology server is configured
                  const errorMsg = (event.detail?.message || event.message || '').toLowerCase();
                  if (errorMsg.includes('terminology') || errorMsg.includes('search') || 
                      errorMsg.includes('fetch') || errorMsg.includes('unexpected error')) {
                    // This is a terminology search error, which is expected without a server
                    // Don't show error to user, just allow manual entry
                    event.preventDefault();
                    event.stopPropagation();
                  }
                };
                
                formElement.addEventListener('error', errorHandler);
                
                // Also catch errors from the shadow DOM
                setTimeout(() => {
                  const shadowRoot = (formElement as any).shadowRoot;
                  if (shadowRoot) {
                    shadowRoot.addEventListener('error', errorHandler);
                    
                    // Set up listeners to capture form data as user types
                    this.setupFormDataCapture(shadowRoot);
                  }
                }, 1000);
                
                // Wait a bit for the form to render
                setTimeout(() => {
                  // Import composition if provided
                  if (this.composition) {
                    setTimeout(() => this.importComposition(), 100);
                  }
                  
                  this.formRendered = true;
                  this.cdr.detectChanges();
                }, 500);
              } catch (err) {
                console.error('Error setting webTemplate:', err);
                this.formRendered = false;
                this.cdr.detectChanges();
              }
            } else {
              // Element not ready yet, try again
              setTimeout(() => checkAndSetTemplate(attempts + 1), 100);
            }
          };
          
          // Start checking after a short delay
          setTimeout(() => checkAndSetTemplate(), 300);
        } catch (innerError) {
          console.error('Error rendering Medblocks form:', innerError);
          this.formRendered = false;
          this.cdr.detectChanges();
        }
      }, 100);
    } catch (error) {
      console.error('Error in renderForm:', error);
      this.formRendered = false;
    }
  }

  importComposition(): void {
    if (!this.formRendered || !this.composition || !this.formElement) {
      return;
    }

    try {
      if (this.formElement && typeof (this.formElement as any).import === 'function') {
        (this.formElement as any).import(this.composition);
      }
    } catch (error) {
      console.error('Error importing composition:', error);
    }
  }

  private setupFormDataCapture(shadowRoot: ShadowRoot): void {
    // Try to capture form data as user types by listening to input events
    const captureInputs = () => {
      const findAllInputs = (root: Document | ShadowRoot | Element, depth: number = 0): any[] => {
        const inputs: any[] = [];
        
        if (depth < 3) {
          const directInputs = root.querySelectorAll('input, textarea, mb-input, mb-textarea, mb-date-time, sl-input');
          inputs.push(...Array.from(directInputs));
          
          const webComponents = root.querySelectorAll('mb-input, mb-textarea, mb-date-time, sl-input');
          webComponents.forEach((comp: any) => {
            if (comp.shadowRoot) {
              const nestedInputs = findAllInputs(comp.shadowRoot, depth + 1);
              inputs.push(...nestedInputs);
            }
          });
        }
        
        return inputs;
      };
      
      const inputs = findAllInputs(shadowRoot);
      
      inputs.forEach((input: any) => {
        // Skip if already has listener
        if ((input as any)._mbDataListener) return;
        
        const captureValue = () => {
          let value: any = null;
          let path: string | null = null;
          
          // Get value
          if (input.shadowRoot) {
            const internalInput = input.shadowRoot.querySelector('input, textarea');
            if (internalInput && (internalInput as any).value) {
              value = (internalInput as any).value;
            }
          }
          
          if (!value && input.value) {
            value = input.value;
          }
          
          // Get path/identifier
          if (input.getAttribute) {
            path = input.getAttribute('path') || input.getAttribute('data-path') || 
                   input.getAttribute('name') || input.id || input.getAttribute('suffix');
          }
          
          if (value !== null && value !== '' && path) {
            this.formDataCache[path] = value;
          }
        };
        
        // Listen to various events
        input.addEventListener('input', captureValue);
        input.addEventListener('change', captureValue);
        input.addEventListener('blur', captureValue);
        
        // Mark as having listener
        (input as any)._mbDataListener = true;
      });
    };
    
    // Try multiple times as form renders
    setTimeout(captureInputs, 500);
    setTimeout(captureInputs, 1500);
    setTimeout(captureInputs, 3000);
  }

  submitForm(): void {
    console.log('submitForm() called');
    console.log('formRendered:', this.formRendered);
    console.log('formElement:', this.formElement);
    
    if (!this.formRendered) {
      console.warn('Form not rendered yet');
      alert('Form is not ready. Please wait for the form to load.');
      return;
    }
    
    if (!this.formElement) {
      console.warn('Form element not found');
      alert('Form element not found. Please reload the form.');
      return;
    }
    
    try {
      console.log('Starting form submission...');
      // Get the form data as openEHR composition in FLAT format
      let compositionData: any = null;
      
      if (typeof (this.formElement as any).export === 'function') {
        compositionData = (this.formElement as any).export();
        console.log('mb-auto-form.export() result:', compositionData);
      } else {
        console.warn('export() function not found on mb-auto-form');
      }
      
      // Try to get data from the internal mb-form if mb-auto-form returns empty
      if (!compositionData || (typeof compositionData === 'object' && Object.keys(compositionData).length === 0)) {
        const shadowRoot = (this.formElement as any).shadowRoot;
        if (shadowRoot) {
          const mbForm = shadowRoot.querySelector('mb-form');
          if (mbForm && typeof (mbForm as any).export === 'function') {
            const formData = (mbForm as any).export();
            console.log('mb-form.export() result:', formData);
            if (formData && typeof formData === 'object' && Object.keys(formData).length > 0) {
              compositionData = formData;
            }
          }
          
          // Also try to get data directly from input elements if export() doesn't work
          if (!compositionData || (typeof compositionData === 'object' && Object.keys(compositionData).length === 0)) {
            const extractedData = this.extractFormDataFromInputs(shadowRoot);
            console.log('extractFormDataFromInputs() result:', extractedData);
            if (extractedData) {
              compositionData = extractedData;
            }
          }
        } else {
          console.warn('Shadow root not found');
        }
      }
      
      // Use cached data if available
      if ((!compositionData || Object.keys(compositionData).length === 0) && Object.keys(this.formDataCache).length > 0) {
        console.log('Using cached form data:', this.formDataCache);
        compositionData = { ...this.formDataCache };
      }
      
      // If we still don't have data, try to get it from the web template structure
      if (!compositionData || (typeof compositionData === 'object' && Object.keys(compositionData).length === 0)) {
        const templateData = this.buildCompositionFromTemplate();
        console.log('buildCompositionFromTemplate() result:', templateData);
        if (templateData) {
          compositionData = templateData;
        }
      }
      
      console.log('Final compositionData:', compositionData);
      
      // Emit the completed composition
      this.formSubmitted.emit({
        type: 'openehr-composition',
        webTemplate: this.webTemplate,
        composition: compositionData,
        timestamp: new Date().toISOString()
      });
      
      console.log('Form submitted event emitted');
    } catch (error) {
      console.error('Error getting form data:', error);
      alert('Error submitting form: ' + (error as Error).message);
    }
  }

  private buildCompositionFromTemplate(): any {
    // Build a basic composition structure from the template
    // This is a fallback if export() doesn't work
    const composition: any = {};
    
    if (!this.webTemplate || !this.webTemplate.tree) {
      return null;
    }
    
    const shadowRoot = (this.formElement as any)?.shadowRoot;
    if (!shadowRoot) {
      return null;
    }
    
    const traverse = (node: any, path: string[] = []): void => {
      if (node.inputs && node.inputs.length > 0) {
        // This is a leaf node with inputs
        // Try to find the input element for this node using multiple strategies
        let input: any = null;
        
        // Strategy 1: Try by path attribute (escape special characters)
        if (node.path) {
          try {
            const escapedPath = node.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            input = shadowRoot.querySelector(`[path="${escapedPath}"]`);
          } catch (e) {
            // If selector fails, try next strategy
          }
        }
        
        // Strategy 2: Try by data-path attribute
        if (!input && node.path) {
          try {
            const escapedPath = node.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            input = shadowRoot.querySelector(`[data-path="${escapedPath}"]`);
          } catch (e) {
            // Continue to next strategy
          }
        }
        
        // Strategy 3: Try by nodeId (but escape dots)
        if (!input && node.nodeId) {
          try {
            const escapedId = node.nodeId.replace(/\./g, '\\.');
            input = shadowRoot.querySelector(`#${escapedId}`);
          } catch (e) {
            // Continue to next strategy
          }
        }
        
        // Strategy 4: Try to find by suffix attribute
        if (!input && node.inputs && node.inputs[0] && node.inputs[0].suffix) {
          try {
            const escapedSuffix = node.inputs[0].suffix.replace(/\./g, '\\.');
            input = shadowRoot.querySelector(`[suffix="${escapedSuffix}"]`);
          } catch (e) {
            // Continue
          }
        }
        
        // Strategy 5: Find all mb-input elements and check their attributes
        if (!input) {
          const allInputs = shadowRoot.querySelectorAll('mb-input, input[type="text"], input[type="date"], textarea');
          for (let i = 0; i < allInputs.length; i++) {
            const candidate = allInputs[i] as any;
            const candidatePath = candidate.getAttribute?.('path') || candidate.getAttribute?.('data-path');
            const candidateSuffix = candidate.getAttribute?.('suffix');
            
            if (candidatePath === node.path || candidateSuffix === node.nodeId) {
              input = candidate;
              break;
            }
          }
        }
        
        if (input) {
          let value: any = null;
          
          // Try to get value from different sources
          if (input.value !== undefined && input.value !== null && input.value !== '') {
            value = input.value;
          } else if (input.getAttribute && input.getAttribute('value')) {
            value = input.getAttribute('value');
          } else if (input.shadowRoot) {
            // If it's a web component, try to get value from its internal input
            const internalInput = input.shadowRoot.querySelector('input, textarea');
            if (internalInput && (internalInput as any).value) {
              value = (internalInput as any).value;
            }
          }
          
          if (value !== null && value !== '') {
            // Store using the path as key (openEHR FLAT format)
            const cleanPath = node.path.replace(/[\[\]]/g, '_').replace(/\//g, '_');
            composition[cleanPath] = value;
          }
        }
      }
      
      if (node.children) {
        node.children.forEach((child: any) => {
          traverse(child, [...path, node.nodeId]);
        });
      }
    };
    
    traverse(this.webTemplate.tree);
    
    return Object.keys(composition).length > 0 ? composition : null;
  }

  private extractFormDataFromInputs(shadowRoot: ShadowRoot): any {
    const formData: any = {};
    
    try {
      console.log('Extracting data from shadow root...');
      
      // First, try to find mb-form and access its shadow DOM
      const mbForm = shadowRoot.querySelector('mb-form');
      if (mbForm && mbForm.shadowRoot) {
        console.log('Found mb-form with shadow root, searching inside...');
        const mbFormShadow = mbForm.shadowRoot;
        
        // Search recursively through all shadow roots
        const findAllInputs = (root: Document | ShadowRoot | Element, depth: number = 0): any[] => {
          const inputs: any[] = [];
          
          // Find all possible input elements
          const directInputs = root.querySelectorAll('input, textarea, mb-input, mb-textarea, mb-date-time, sl-input, sl-textarea');
          inputs.push(...Array.from(directInputs));
          
          // Also check web components that might have shadow roots
          const webComponents = root.querySelectorAll('mb-input, mb-textarea, mb-date-time, sl-input, sl-textarea, sl-date-picker');
          webComponents.forEach((comp: any) => {
            if (comp.shadowRoot && depth < 3) {
              // Recursively search inside web component shadow roots
              const nestedInputs = findAllInputs(comp.shadowRoot, depth + 1);
              inputs.push(...nestedInputs);
            }
          });
          
          return inputs;
        };
        
        const allInputs = findAllInputs(mbFormShadow);
        console.log('Found inputs (including nested):', allInputs.length);
      
      allInputs.forEach((input: any, index: number) => {
        let value: any = null;
        let path: string | null = null;
        
        console.log(`Input ${index}:`, input.tagName, input);
        
        // Try to get value from different properties
        // First check if it's a web component (mb-input, etc.)
        if (input.shadowRoot) {
          const internalInput = input.shadowRoot.querySelector('input, textarea, sl-input');
          if (internalInput) {
            console.log(`  Found internal input:`, internalInput);
            if (internalInput.value !== undefined && internalInput.value !== null && internalInput.value !== '') {
              value = internalInput.value;
              console.log(`  Value from internal input:`, value);
            } else if ((internalInput as any).getAttribute && (internalInput as any).getAttribute('value')) {
              value = (internalInput as any).getAttribute('value');
              console.log(`  Value from internal input attribute:`, value);
            }
          }
        }
        
        // If not found in shadow root, try direct value
        if (value === null && input.value !== undefined && input.value !== null && input.value !== '') {
          value = input.value;
          console.log(`  Value from direct input:`, value);
        } else if (value === null && input.getAttribute && input.getAttribute('value')) {
          value = input.getAttribute('value');
          console.log(`  Value from input attribute:`, value);
        }
        
        // Try to get the path from various attributes
        if (input.getAttribute) {
          path = input.getAttribute('path') || 
                 input.getAttribute('data-path') || 
                 input.getAttribute('name') ||
                 input.id ||
                 input.getAttribute('suffix');
          console.log(`  Path:`, path);
        }
        
        // If we have a value and a path, add to form data
        if (value !== null && value !== '' && path) {
          // Store using a clean version of the path as key
          const cleanPath = path.replace(/[\[\]]/g, '_').replace(/\//g, '_');
          formData[cleanPath] = value;
          console.log(`  Added to formData: ${cleanPath} = ${value}`);
        } else if (value !== null && value !== '') {
          // Even without path, store with a generic key
          formData[`field_${index}`] = value;
          console.log(`  Added to formData without path: field_${index} = ${value}`);
        }
        });
        
        // Also try to get data from mb-form's internal state if available
        console.log('mb-form found, checking properties...');
        console.log('mb-form.data:', (mbForm as any).data);
        console.log('mb-form.formData:', (mbForm as any).formData);
        console.log('mb-form.value:', (mbForm as any).value);
        console.log('mb-form.form:', (mbForm as any).form);
        
        // Try different properties that might contain the form data
        const formState = (mbForm as any).data || (mbForm as any).formData || (mbForm as any).value || (mbForm as any).form;
        if (formState && typeof formState === 'object' && Object.keys(formState).length > 0) {
          console.log('Found form state:', formState);
          Object.assign(formData, formState);
        }
      } else {
        // Fallback: search in the main shadow root
        const allInputs = shadowRoot.querySelectorAll('mb-input, mb-textarea, mb-date-time, input, textarea, sl-input');
        console.log('Found inputs in main shadow root:', allInputs.length);
        
        allInputs.forEach((input: any, index: number) => {
          let value: any = null;
          let path: string | null = null;
          
          console.log(`Input ${index}:`, input.tagName, input);
          
          // Try to get value from different properties
          if (input.shadowRoot) {
            const internalInput = input.shadowRoot.querySelector('input, textarea, sl-input');
            if (internalInput) {
              if (internalInput.value !== undefined && internalInput.value !== null && internalInput.value !== '') {
                value = internalInput.value;
              }
            }
          }
          
          if (value === null && input.value !== undefined && input.value !== null && input.value !== '') {
            value = input.value;
          }
          
          if (input.getAttribute) {
            path = input.getAttribute('path') || input.getAttribute('data-path') || input.getAttribute('name') || input.id;
          }
          
          if (value !== null && value !== '' && path) {
            const cleanPath = path.replace(/[\[\]]/g, '_').replace(/\//g, '_');
            formData[cleanPath] = value;
          }
        });
      }
      
      console.log('Final extracted formData:', formData);
      
      // Return formData only if it has content
      return Object.keys(formData).length > 0 ? formData : null;
    } catch (error) {
      console.error('Error extracting form data from inputs:', error);
      return null;
    }
  }

  cancel(): void {
    this.formCancelled.emit();
  }

  getFormContainerId(): string {
    return this.formContainerId;
  }
}

