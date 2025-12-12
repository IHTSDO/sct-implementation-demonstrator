import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { lastValueFrom } from 'rxjs';
import cloneDeep from 'lodash/cloneDeep';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';

interface TreeNode {
  name: string;
  type: 'stakeholder' | 'kpa' | 'question' | 'option';
  stakeholderIndex?: number;
  kpaIndex?: number;
  questionIndex?: number;
  optionIndex?: number;
  children?: TreeNode[];
}

@Component({
  selector: 'app-maturity-editor',
  templateUrl: './maturity-editor.component.html',
  styleUrl: './maturity-editor.component.css',
  standalone: false
})
export class MaturityEditorComponent implements OnInit {
  maturitySpec: any = { stakeHolders: [], flipCards: [] };
  originalSpec: any = null;
  selectedStakeholderIndex: number | null = null;
  selectedKpaIndex: number | null = null;
  selectedQuestionIndex: number | null = null;
  selectedOptionIndex: number | null = null;
  
  specSource: 'default' | 'loaded' | 'saved' = 'default';
  private readonly STORAGE_KEY = 'maturitySpecEditor';
  
  treeControl = new NestedTreeControl<TreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<TreeNode>();
  expandedNodes = new Set<string>();
  
  stakeholderForm: FormGroup;
  kpaForm: FormGroup;
  questionForm: FormGroup;
  optionForm: FormGroup;
  titleForm: FormGroup;
  subtitleForm: FormGroup;
  flipCardForm: FormGroup;
  flipCardItemForm: FormGroup;
  
  selectedFlipCardIndex: number | null = null;
  selectedFlipCardItemIndex: number | null = null;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.stakeholderForm = this.fb.group({
      name: ['', Validators.required],
      id: ['', Validators.required],
      description: ['', Validators.required]
    });

    this.kpaForm = this.fb.group({
      name: ['', Validators.required],
      id: ['', Validators.required],
      description: ['', Validators.required]
    });

    this.questionForm = this.fb.group({
      name: ['', Validators.required],
      id: ['', Validators.required],
      question: ['', Validators.required],
      context: ['']
    });

    this.optionForm = this.fb.group({
      id: [1, Validators.required],
      text: ['', Validators.required],
      score: [0, Validators.required],
      example: ['']
    });

    this.titleForm = this.fb.group({
      title: ['', Validators.required]
    });

    this.subtitleForm = this.fb.group({
      subtitle: ['', Validators.required]
    });

    this.flipCardForm = this.fb.group({
      title: ['', Validators.required],
      frontText: ['', Validators.required]
    });

    this.flipCardItemForm = this.fb.group({
      title: ['', Validators.required],
      text: ['', Validators.required]
    });
  }

  async ngOnInit() {
    // Try to load from localStorage first
    const savedSpec = localStorage.getItem(this.STORAGE_KEY);
    if (savedSpec) {
      try {
        this.maturitySpec = JSON.parse(savedSpec);
        // Ensure flipCards array exists
        if (!this.maturitySpec.flipCards) {
          this.maturitySpec.flipCards = [];
        }
        this.originalSpec = cloneDeep(this.maturitySpec);
        this.specSource = 'saved';
        this.buildTree();
        this.initializeWelcomeForms();
        this.showMessage('Loaded saved specification from local storage', 'success');
        return;
      } catch (error) {
        console.error('Error loading saved spec:', error);
        // Fall through to load default
      }
    }
    
    // Load default if no saved spec or error loading
    await this.loadSpecification();
    this.buildTree();
    // Initialize title and subtitle forms
    this.initializeWelcomeForms();
  }

  initializeWelcomeForms() {
    this.titleForm.patchValue({
      title: this.maturitySpec.title || ''
    });
    this.subtitleForm.patchValue({
      subtitle: this.maturitySpec.subtitle || ''
    });
  }

  hasChild = (_: number, node: TreeNode) => !!node.children && node.children.length > 0;

  buildTree() {
    // Save current expansion state
    this.saveExpansionState();
    
    const treeData: TreeNode[] = this.maturitySpec.stakeHolders.map((stakeholder: any, i: number) => {
      const stakeholderNode: TreeNode = {
        name: stakeholder.name || 'Unnamed Stakeholder',
        type: 'stakeholder',
        stakeholderIndex: i,
        children: stakeholder.kpas?.map((kpa: any, j: number) => {
          const kpaNode: TreeNode = {
            name: kpa.name || 'Unnamed KPA',
            type: 'kpa',
            stakeholderIndex: i,
            kpaIndex: j,
            children: kpa.questions?.map((question: any, k: number) => ({
              name: question.name || 'Unnamed Question',
              type: 'question',
              stakeholderIndex: i,
              kpaIndex: j,
              questionIndex: k,
              children: question.options?.map((option: any, l: number) => ({
                name: `${option.id}. ${option.text || 'Unnamed Option'}`,
                type: 'option',
                stakeholderIndex: i,
                kpaIndex: j,
                questionIndex: k,
                optionIndex: l
              })) || []
            })) || []
          };
          return kpaNode;
        }) || []
      };
      return stakeholderNode;
    });
    this.dataSource.data = treeData;
    
    // Restore expansion state
    this.restoreExpansionState();
  }

  saveExpansionState() {
    this.expandedNodes.clear();
    const saveNodeExpansion = (node: TreeNode) => {
      if (this.treeControl.isExpanded(node)) {
        const key = this.getNodeKey(node);
        this.expandedNodes.add(key);
        node.children?.forEach(child => saveNodeExpansion(child));
      }
    };
    this.dataSource.data?.forEach(node => saveNodeExpansion(node));
  }

  restoreExpansionState() {
    const restoreNodeExpansion = (node: TreeNode) => {
      const key = this.getNodeKey(node);
      if (this.expandedNodes.has(key)) {
        this.treeControl.expand(node);
      }
      node.children?.forEach(child => restoreNodeExpansion(child));
    };
    this.dataSource.data?.forEach(node => restoreNodeExpansion(node));
  }

  getNodeKey(node: TreeNode): string {
    if (node.type === 'stakeholder' && node.stakeholderIndex !== undefined) {
      return `stakeholder_${node.stakeholderIndex}`;
    } else if (node.type === 'kpa' && node.stakeholderIndex !== undefined && node.kpaIndex !== undefined) {
      return `stakeholder_${node.stakeholderIndex}_kpa_${node.kpaIndex}`;
    } else if (node.type === 'question' && node.stakeholderIndex !== undefined && 
               node.kpaIndex !== undefined && node.questionIndex !== undefined) {
      return `stakeholder_${node.stakeholderIndex}_kpa_${node.kpaIndex}_question_${node.questionIndex}`;
    } else if (node.type === 'option' && node.stakeholderIndex !== undefined && 
               node.kpaIndex !== undefined && node.questionIndex !== undefined && node.optionIndex !== undefined) {
      return `stakeholder_${node.stakeholderIndex}_kpa_${node.kpaIndex}_question_${node.questionIndex}_option_${node.optionIndex}`;
    }
    return '';
  }

  async loadSpecification() {
    // Check if there's saved data in localStorage
    const savedSpec = localStorage.getItem(this.STORAGE_KEY);
    if (savedSpec) {
      const confirmed = confirm('There is a saved specification in local storage. Loading the default will discard all saved changes. Do you want to continue?');
      if (!confirmed) {
        return;
      }
      localStorage.removeItem(this.STORAGE_KEY);
    }

    try {
      this.maturitySpec = await lastValueFrom(this.http.get('assets/maturity/maturityLevels.json'));
      // Ensure flipCards array exists
      if (!this.maturitySpec.flipCards) {
        this.maturitySpec.flipCards = [];
      }
      this.originalSpec = cloneDeep(this.maturitySpec);
      this.specSource = 'default';
      this.buildTree();
      this.initializeWelcomeForms();
      this.showMessage('Specification loaded successfully', 'success');
    } catch (error) {
      this.showMessage('Error loading specification', 'error');
      console.error(error);
    }
  }

  saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.maturitySpec));
      // Mark as saved after first save
      if (this.specSource !== 'saved') {
        this.specSource = 'saved';
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  uploadSpecification(event: any) {
    if (event.target.files.length !== 1) {
      this.showMessage('No file selected', 'error');
      return;
    }

    // Check if there's saved data in localStorage
    const savedSpec = localStorage.getItem(this.STORAGE_KEY);
    if (savedSpec) {
      const confirmed = confirm('There is a saved specification in local storage. Uploading a new file will discard all saved changes. Do you want to continue?');
      if (!confirmed) {
        // Reset the file input
        event.target.value = '';
        return;
      }
      localStorage.removeItem(this.STORAGE_KEY);
    }

    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (reader.result) {
        try {
          this.maturitySpec = JSON.parse(reader.result.toString());
          // Ensure flipCards array exists
          if (!this.maturitySpec.flipCards) {
            this.maturitySpec.flipCards = [];
          }
          this.originalSpec = cloneDeep(this.maturitySpec);
          this.specSource = 'loaded';
          this.saveToLocalStorage();
          this.buildTree();
          this.initializeWelcomeForms();
          this.clearSelection();
          this.showMessage('Specification uploaded successfully', 'success');
        } catch (error) {
          this.showMessage('Error parsing JSON file', 'error');
          console.error(error);
        }
      }
    };
    reader.readAsText(event.target.files[0]);
  }

  downloadSpecification(): void {
    const dataStr = JSON.stringify(this.maturitySpec, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'maturity_specification.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    this.showMessage('Specification downloaded successfully', 'success');
  }

  // Stakeholder operations
  addStakeholder() {
    const newStakeholder = {
      name: '',
      id: '',
      description: '',
      kpas: []
    };
    this.maturitySpec.stakeHolders.push(newStakeholder);
    this.saveToLocalStorage();
    this.buildTree();
    this.selectedStakeholderIndex = this.maturitySpec.stakeHolders.length - 1;
    this.editStakeholder(this.selectedStakeholderIndex);
  }

  editStakeholder(index: number) {
    this.selectedStakeholderIndex = index;
    this.selectedKpaIndex = null;
    this.selectedQuestionIndex = null;
    this.selectedOptionIndex = null;
    const stakeholder = this.maturitySpec.stakeHolders[index];
    this.stakeholderForm.patchValue({
      name: stakeholder.name,
      id: stakeholder.id,
      description: stakeholder.description
    });
  }

  saveStakeholder() {
    if (this.stakeholderForm.invalid || this.selectedStakeholderIndex === null) {
      this.showMessage('Please fill all required fields', 'error');
      return;
    }

    const formValue = this.stakeholderForm.value;
    this.maturitySpec.stakeHolders[this.selectedStakeholderIndex] = {
      ...this.maturitySpec.stakeHolders[this.selectedStakeholderIndex],
      ...formValue
    };
    this.saveToLocalStorage();
    this.buildTree();
    this.showMessage('Stakeholder saved successfully. Click "Download Spec" to save the file.', 'success');
    // Update form with saved values to keep editor open
    this.stakeholderForm.patchValue(formValue);
  }

  deleteStakeholder(index: number) {
    if (confirm('Are you sure you want to delete this stakeholder? This will also delete all associated KPAs and questions.')) {
      this.maturitySpec.stakeHolders.splice(index, 1);
      this.saveToLocalStorage();
      this.buildTree();
      this.clearSelection();
      this.showMessage('Stakeholder deleted successfully', 'success');
    }
  }

  // KPA operations
  addKpa() {
    if (this.selectedStakeholderIndex === null) {
      this.showMessage('Please select a stakeholder first', 'error');
      return;
    }

    const newKpa = {
      name: '',
      id: '',
      description: '',
      questions: []
    };
    this.maturitySpec.stakeHolders[this.selectedStakeholderIndex].kpas.push(newKpa);
    this.saveToLocalStorage();
    this.buildTree();
    this.selectedKpaIndex = this.maturitySpec.stakeHolders[this.selectedStakeholderIndex].kpas.length - 1;
    this.editKpa(this.selectedKpaIndex);
  }

  editKpa(index: number) {
    if (this.selectedStakeholderIndex === null) return;
    
    this.selectedKpaIndex = index;
    this.selectedQuestionIndex = null;
    this.selectedOptionIndex = null;
    const kpa = this.maturitySpec.stakeHolders[this.selectedStakeholderIndex].kpas[index];
    this.kpaForm.patchValue({
      name: kpa.name,
      id: kpa.id,
      description: kpa.description
    });
  }

  saveKpa() {
    if (this.kpaForm.invalid || this.selectedStakeholderIndex === null || this.selectedKpaIndex === null) {
      this.showMessage('Please fill all required fields', 'error');
      return;
    }

    const formValue = this.kpaForm.value;
    this.maturitySpec.stakeHolders[this.selectedStakeholderIndex].kpas[this.selectedKpaIndex] = {
      ...this.maturitySpec.stakeHolders[this.selectedStakeholderIndex].kpas[this.selectedKpaIndex],
      ...formValue
    };
    this.saveToLocalStorage();
    this.buildTree();
    this.showMessage('KPA saved successfully. Click "Download Spec" to save the file.', 'success');
    this.selectedQuestionIndex = null;
    this.selectedOptionIndex = null;
  }

  deleteKpa(index: number) {
    if (this.selectedStakeholderIndex === null) return;
    
    if (confirm('Are you sure you want to delete this KPA? This will also delete all associated questions.')) {
      this.maturitySpec.stakeHolders[this.selectedStakeholderIndex].kpas.splice(index, 1);
      this.saveToLocalStorage();
      this.buildTree();
      this.selectedKpaIndex = null;
      this.selectedQuestionIndex = null;
      this.selectedOptionIndex = null;
      this.showMessage('KPA deleted successfully', 'success');
    }
  }

  // Question operations
  addQuestion() {
    if (this.selectedStakeholderIndex === null || this.selectedKpaIndex === null) {
      this.showMessage('Please select a stakeholder and KPA first', 'error');
      return;
    }

    const newQuestion = {
      name: '',
      id: '',
      question: '',
      context: '',
      options: []
    };
    const kpa = this.maturitySpec.stakeHolders[this.selectedStakeholderIndex].kpas[this.selectedKpaIndex];
    kpa.questions.push(newQuestion);
    this.saveToLocalStorage();
    this.buildTree();
    this.selectedQuestionIndex = kpa.questions.length - 1;
    this.editQuestion(this.selectedQuestionIndex);
  }

  editQuestion(index: number) {
    if (this.selectedStakeholderIndex === null || this.selectedKpaIndex === null) return;
    
    this.selectedQuestionIndex = index;
    this.selectedOptionIndex = null;
    const question = this.maturitySpec.stakeHolders[this.selectedStakeholderIndex]
      .kpas[this.selectedKpaIndex].questions[index];
    this.questionForm.patchValue({
      name: question.name,
      id: question.id,
      question: question.question,
      context: question.context || ''
    });
  }

  saveQuestion() {
    if (this.questionForm.invalid || this.selectedStakeholderIndex === null || 
        this.selectedKpaIndex === null || this.selectedQuestionIndex === null) {
      this.showMessage('Please fill all required fields', 'error');
      return;
    }

    const formValue = this.questionForm.value;
    const question = this.maturitySpec.stakeHolders[this.selectedStakeholderIndex]
      .kpas[this.selectedKpaIndex].questions[this.selectedQuestionIndex];
    
    this.maturitySpec.stakeHolders[this.selectedStakeholderIndex]
      .kpas[this.selectedKpaIndex].questions[this.selectedQuestionIndex] = {
      ...question,
      ...formValue
    };
    this.saveToLocalStorage();
    this.buildTree();
    this.showMessage('Question saved successfully. Click "Download Spec" to save the file.', 'success');
    this.selectedOptionIndex = null;
  }

  deleteQuestion(index: number) {
    if (this.selectedStakeholderIndex === null || this.selectedKpaIndex === null) return;
    
    if (confirm('Are you sure you want to delete this question? This will also delete all associated options.')) {
      this.maturitySpec.stakeHolders[this.selectedStakeholderIndex]
        .kpas[this.selectedKpaIndex].questions.splice(index, 1);
      this.saveToLocalStorage();
      this.buildTree();
      this.selectedQuestionIndex = null;
      this.selectedOptionIndex = null;
      this.showMessage('Question deleted successfully', 'success');
    }
  }

  // Option operations
  addOption() {
    if (this.selectedStakeholderIndex === null || this.selectedKpaIndex === null || 
        this.selectedQuestionIndex === null) {
      this.showMessage('Please select a stakeholder, KPA, and question first', 'error');
      return;
    }

    const question = this.maturitySpec.stakeHolders[this.selectedStakeholderIndex]
      .kpas[this.selectedKpaIndex].questions[this.selectedQuestionIndex];
    
    const maxId = question.options.length > 0 
      ? Math.max(...question.options.map((opt: any) => opt.id || 0))
      : 0;
    
    const newOption = {
      id: maxId + 1,
      text: '',
      score: 0,
      example: ''
    };
    question.options.push(newOption);
    this.saveToLocalStorage();
    this.selectedOptionIndex = question.options.length - 1;
    this.editOption(this.selectedOptionIndex);
  }

  editOption(index: number) {
    if (this.selectedStakeholderIndex === null || this.selectedKpaIndex === null || 
        this.selectedQuestionIndex === null) return;
    
    this.selectedOptionIndex = index;
    const option = this.maturitySpec.stakeHolders[this.selectedStakeholderIndex]
      .kpas[this.selectedKpaIndex].questions[this.selectedQuestionIndex].options[index];
    this.optionForm.patchValue({
      id: option.id,
      text: option.text,
      score: option.score,
      example: option.example || ''
    });
  }

  saveOption() {
    if (this.optionForm.invalid || this.selectedStakeholderIndex === null || 
        this.selectedKpaIndex === null || this.selectedQuestionIndex === null || 
        this.selectedOptionIndex === null) {
      this.showMessage('Please fill all required fields', 'error');
      return;
    }

    const formValue = this.optionForm.value;
    this.maturitySpec.stakeHolders[this.selectedStakeholderIndex]
      .kpas[this.selectedKpaIndex].questions[this.selectedQuestionIndex]
      .options[this.selectedOptionIndex] = formValue;
    this.saveToLocalStorage();
    this.buildTree();
    this.showMessage('Option saved successfully. Click "Download Spec" to save the file.', 'success');
    // Update form with saved values to keep editor open
    this.optionForm.patchValue(formValue);
  }

  deleteOption(index: number) {
    if (this.selectedStakeholderIndex === null || this.selectedKpaIndex === null || 
        this.selectedQuestionIndex === null) return;
    
    if (confirm('Are you sure you want to delete this option?')) {
      this.maturitySpec.stakeHolders[this.selectedStakeholderIndex]
        .kpas[this.selectedKpaIndex].questions[this.selectedQuestionIndex]
        .options.splice(index, 1);
      this.saveToLocalStorage();
      this.selectedOptionIndex = null;
      this.showMessage('Option deleted successfully', 'success');
    }
  }

  // Title and Subtitle operations
  editTitle() {
    this.titleForm.patchValue({
      title: this.maturitySpec.title || ''
    });
  }

  saveTitle() {
    if (this.titleForm.invalid) {
      this.showMessage('Title is required', 'error');
      return;
    }
    this.maturitySpec.title = this.titleForm.value.title;
    this.saveToLocalStorage();
    this.showMessage('Title saved successfully. Click "Download Spec" to save the file.', 'success');
  }

  editSubtitle() {
    this.subtitleForm.patchValue({
      subtitle: this.maturitySpec.subtitle || ''
    });
  }

  saveSubtitle() {
    if (this.subtitleForm.invalid) {
      this.showMessage('Subtitle is required', 'error');
      return;
    }
    this.maturitySpec.subtitle = this.subtitleForm.value.subtitle;
    this.saveToLocalStorage();
    this.showMessage('Subtitle saved successfully. Click "Download Spec" to save the file.', 'success');
  }

  // Flip Card operations
  addFlipCard() {
    if (!this.maturitySpec.flipCards) {
      this.maturitySpec.flipCards = [];
    }
    const newFlipCard = {
      title: '',
      front: { text: '' },
      back: { items: [] }
    };
    this.maturitySpec.flipCards.push(newFlipCard);
    this.saveToLocalStorage();
    this.selectedFlipCardIndex = this.maturitySpec.flipCards.length - 1;
    this.editFlipCard(this.selectedFlipCardIndex);
  }

  editFlipCard(index: number) {
    this.selectedFlipCardIndex = index;
    this.selectedFlipCardItemIndex = null;
    const flipCard = this.maturitySpec.flipCards[index];
    this.flipCardForm.patchValue({
      title: flipCard.title || '',
      frontText: flipCard.front?.text || ''
    });
  }

  saveFlipCard() {
    if (this.flipCardForm.invalid || this.selectedFlipCardIndex === null) {
      this.showMessage('Please fill all required fields', 'error');
      return;
    }

    const formValue = this.flipCardForm.value;
    const flipCard = this.maturitySpec.flipCards[this.selectedFlipCardIndex];
    this.maturitySpec.flipCards[this.selectedFlipCardIndex] = {
      ...flipCard,
      title: formValue.title,
      front: { text: formValue.frontText },
      back: flipCard.back || { items: [] }
    };
    this.saveToLocalStorage();
    this.showMessage('Flip card saved successfully. Click "Download Spec" to save the file.', 'success');
  }

  deleteFlipCard(index: number) {
    if (confirm('Are you sure you want to delete this flip card? This will also delete all associated items.')) {
      this.maturitySpec.flipCards.splice(index, 1);
      this.saveToLocalStorage();
      this.selectedFlipCardIndex = null;
      this.selectedFlipCardItemIndex = null;
      this.showMessage('Flip card deleted successfully', 'success');
    }
  }

  // Flip Card Item operations
  addFlipCardItem() {
    if (this.selectedFlipCardIndex === null) {
      this.showMessage('Please select a flip card first', 'error');
      return;
    }

    if (!this.maturitySpec.flipCards[this.selectedFlipCardIndex].back) {
      this.maturitySpec.flipCards[this.selectedFlipCardIndex].back = { items: [] };
    }
    if (!this.maturitySpec.flipCards[this.selectedFlipCardIndex].back.items) {
      this.maturitySpec.flipCards[this.selectedFlipCardIndex].back.items = [];
    }

    const newItem = {
      title: '',
      text: ''
    };
    this.maturitySpec.flipCards[this.selectedFlipCardIndex].back.items.push(newItem);
    this.saveToLocalStorage();
    this.selectedFlipCardItemIndex = this.maturitySpec.flipCards[this.selectedFlipCardIndex].back.items.length - 1;
    this.editFlipCardItem(this.selectedFlipCardItemIndex);
  }

  editFlipCardItem(index: number) {
    if (this.selectedFlipCardIndex === null) return;
    
    this.selectedFlipCardItemIndex = index;
    const item = this.maturitySpec.flipCards[this.selectedFlipCardIndex].back.items[index];
    this.flipCardItemForm.patchValue({
      title: item.title || '',
      text: item.text || ''
    });
  }

  saveFlipCardItem() {
    if (this.flipCardItemForm.invalid || this.selectedFlipCardIndex === null || this.selectedFlipCardItemIndex === null) {
      this.showMessage('Please fill all required fields', 'error');
      return;
    }

    const formValue = this.flipCardItemForm.value;
    this.maturitySpec.flipCards[this.selectedFlipCardIndex].back.items[this.selectedFlipCardItemIndex] = formValue;
    this.saveToLocalStorage();
    this.showMessage('Flip card item saved successfully. Click "Download Spec" to save the file.', 'success');
    this.flipCardItemForm.patchValue(formValue);
  }

  deleteFlipCardItem(index: number) {
    if (this.selectedFlipCardIndex === null) return;
    
    if (confirm('Are you sure you want to delete this flip card item?')) {
      this.maturitySpec.flipCards[this.selectedFlipCardIndex].back.items.splice(index, 1);
      this.saveToLocalStorage();
      this.selectedFlipCardItemIndex = null;
      this.showMessage('Flip card item deleted successfully', 'success');
    }
  }

  getSelectedFlipCard() {
    if (this.selectedFlipCardIndex === null) return null;
    return this.maturitySpec.flipCards[this.selectedFlipCardIndex];
  }

  // Helper methods
  clearSelection() {
    this.selectedStakeholderIndex = null;
    this.selectedKpaIndex = null;
    this.selectedQuestionIndex = null;
    this.selectedOptionIndex = null;
    this.selectedFlipCardIndex = null;
    this.selectedFlipCardItemIndex = null;
    this.stakeholderForm.reset();
    this.kpaForm.reset();
    this.questionForm.reset();
    this.optionForm.reset();
    this.titleForm.reset();
    this.subtitleForm.reset();
    this.flipCardForm.reset();
    this.flipCardItemForm.reset();
  }

  getSelectedStakeholder() {
    if (this.selectedStakeholderIndex === null) return null;
    return this.maturitySpec.stakeHolders[this.selectedStakeholderIndex];
  }

  getSelectedKpa() {
    const stakeholder = this.getSelectedStakeholder();
    if (!stakeholder || this.selectedKpaIndex === null) return null;
    return stakeholder.kpas[this.selectedKpaIndex];
  }

  getSelectedQuestion() {
    const kpa = this.getSelectedKpa();
    if (!kpa || this.selectedQuestionIndex === null) return null;
    return kpa.questions[this.selectedQuestionIndex];
  }

  showMessage(message: string, type: 'success' | 'error' = 'success') {
    this.snackBar.openFromComponent(SnackAlertComponent, {
      duration: 3000,
      data: message,
      panelClass: type === 'success' ? ['green-snackbar'] : ['red-snackbar']
    });
  }

  resetToOriginal() {
    if (confirm('Are you sure you want to reset all changes? This cannot be undone.')) {
      this.maturitySpec = cloneDeep(this.originalSpec);
      // Reset to the original source type
      if (this.originalSpec && Object.keys(this.originalSpec).length > 0 && this.originalSpec.stakeHolders?.length > 0) {
        // If original was from default asset, keep as default
        this.specSource = 'default';
      }
      this.saveToLocalStorage();
      this.buildTree();
      this.clearSelection();
      this.showMessage('Specification reset to original', 'success');
    }
  }

  createBlankSpec(): void {
    if (confirm('Are you sure you want to create a blank specification? All current changes will be lost.')) {
      this.maturitySpec = {
        title: '',
        subtitle: '',
        flipCards: [],
        stakeHolders: []
      };
      this.originalSpec = cloneDeep(this.maturitySpec);
      this.specSource = 'default';
      this.saveToLocalStorage();
      this.buildTree();
      this.clearSelection();
      this.showMessage('Blank specification created. Start by adding a stakeholder.', 'success');
    }
  }

  previewSpecification(): void {
    // Save the current spec to localStorage for preview
    try {
      const specJson = JSON.stringify(this.maturitySpec);
      localStorage.setItem('maturitySpecPreview', specJson);
      // Open maturity-main in a new tab/window with preview mode
      // Use hash routing format
      const baseUrl = window.location.origin;
      window.open(`${baseUrl}/#/maturity?preview=true`, '_blank');
      this.showMessage('Opening preview in new tab...', 'success');
    } catch (error) {
      this.showMessage('Error preparing preview', 'error');
      console.error(error);
    }
  }

  selectNode(node: TreeNode) {
    if (node.type === 'stakeholder' && node.stakeholderIndex !== undefined) {
      this.selectedStakeholderIndex = node.stakeholderIndex;
      this.editStakeholder(node.stakeholderIndex);
    } else if (node.type === 'kpa' && node.stakeholderIndex !== undefined && node.kpaIndex !== undefined) {
      this.selectedStakeholderIndex = node.stakeholderIndex;
      this.selectedKpaIndex = node.kpaIndex;
      this.editKpa(node.kpaIndex);
    } else if (node.type === 'question' && node.stakeholderIndex !== undefined && 
               node.kpaIndex !== undefined && node.questionIndex !== undefined) {
      this.selectedStakeholderIndex = node.stakeholderIndex;
      this.selectedKpaIndex = node.kpaIndex;
      this.selectedQuestionIndex = node.questionIndex;
      this.editQuestion(node.questionIndex);
    } else if (node.type === 'option' && node.stakeholderIndex !== undefined && 
               node.kpaIndex !== undefined && node.questionIndex !== undefined && node.optionIndex !== undefined) {
      this.selectedStakeholderIndex = node.stakeholderIndex;
      this.selectedKpaIndex = node.kpaIndex;
      this.selectedQuestionIndex = node.questionIndex;
      this.selectedOptionIndex = node.optionIndex;
      this.editOption(node.optionIndex);
    }
  }
}
