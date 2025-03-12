// src/services/templateService.ts

interface NoteTemplate {
    name: string;
    content: string;
    tags: string[];
    description: string;
  }
  
  // Built-in templates
  const builtInTemplates: Record<string, NoteTemplate> = {
    'meeting': {
      name: 'Meeting Notes',
      content: `# Meeting Notes: [Title]
  
  ## Date: [Date]
  ## Participants: [Names]
  
  ## Agenda
  1. 
  2. 
  3. 
  
  ## Discussion
  - 
  
  ## Action Items
  - [ ] 
  - [ ] 
  
  ## Next Steps
  
  `,
      tags: ['meeting', 'notes'],
      description: 'Notes from a meeting'
    },
    
    'task': {
      name: 'Task List',
      content: `# Task List: [Project Name]
  
  ## Priority Tasks
  - [ ] 
  - [ ] 
  - [ ] 
  
  ## Secondary Tasks
  - [ ] 
  - [ ] 
  
  ## Notes
  
  ## Deadline
  [Date]
  `,
      tags: ['tasks', 'todo'],
      description: 'A task list or to-do list'
    },
    
    'journal': {
      name: 'Journal Entry',
      content: `# Journal: [Date]
  
  ## Summary
  [Brief summary of the day]
  
  ## Highlights
  - 
  - 
  
  ## Thoughts
  - 
  
  ## Tomorrow
  - [ ] 
  - [ ] 
  `,
      tags: ['journal', 'personal'],
      description: 'Personal journal entry'
    },
    
    'project': {
      name: 'Project Outline',
      content: `# Project: [Name]
  
  ## Overview
  [Brief description of the project]
  
  ## Goals
  - 
  - 
  
  ## Timeline
  - Start: [Date]
  - Milestone 1: [Date]
  - Milestone 2: [Date]
  - Completion: [Date]
  
  ## Resources
  - 
  - 
  
  ## Notes
  
  `,
      tags: ['project', 'planning'],
      description: 'Project outline and planning document'
    },
    
    'research': {
      name: 'Research Notes',
      content: `# Research: [Topic]
  
  ## Overview
  [Brief description of the research topic]
  
  ## Key Points
  - 
  - 
  
  ## Sources
  1. 
  2. 
  
  ## Questions
  - 
  - 
  
  ## Notes
  `,
      tags: ['research', 'notes'],
      description: 'Research notes on a topic'
    }
  };
  
  // Load custom templates from localStorage
  const loadCustomTemplates = (): Record<string, NoteTemplate> => {
    if (typeof window === 'undefined') return {};
    
    const savedTemplates = localStorage.getItem('customTemplates');
    if (!savedTemplates) return {};
    
    try {
      const parsedTemplates = JSON.parse(savedTemplates);
      return typeof parsedTemplates === 'object' ? parsedTemplates : {};
    } catch (e) {
      console.error('Error parsing saved templates:', e);
      return {};
    }
  };
  
  // Save custom templates to localStorage
  const saveCustomTemplates = (templates: Record<string, NoteTemplate>): void => {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('customTemplates', JSON.stringify(templates));
  };
  
  // Get all templates (built-in + custom)
  export const getTemplates = (): Record<string, NoteTemplate> => {
    const customTemplates = loadCustomTemplates();
    return { ...builtInTemplates, ...customTemplates };
  };
  
  // Function to get all template names
  export const getTemplateNames = (): string[] => {
    return Object.keys(getTemplates());
  };
  
  // Function to get a specific template
  export const getTemplate = (name: string): NoteTemplate | null => {
    const templates = getTemplates();
    return templates[name] || null;
  };
  
  // Function to save a new custom template
  export const saveTemplate = (name: string, template: NoteTemplate): boolean => {
    // Don't allow overwriting built-in templates
    if (builtInTemplates[name]) {
      return false;
    }
    
    const customTemplates = loadCustomTemplates();
    customTemplates[name] = template;
    saveCustomTemplates(customTemplates);
    return true;
  };
  
  // Function to delete a custom template
  export const deleteTemplate = (name: string): boolean => {
    // Don't allow deleting built-in templates
    if (builtInTemplates[name]) {
      return false;
    }
    
    const customTemplates = loadCustomTemplates();
    if (!customTemplates[name]) {
      return false;
    }
    
    delete customTemplates[name];
    saveCustomTemplates(customTemplates);
    return true;
  };
  
  // Function to check if a template is built-in
  export const isBuiltInTemplate = (name: string): boolean => {
    return !!builtInTemplates[name];
  };
  
  // Function to parse template command arguments
  export const parseTemplateArgs = (args: string[]): { 
    templateName: string; 
    fileName: string;
  } | null => {
    if (args.length === 0) return null;
    
    // Check for --template flag
    const templateFlagIndex = args.findIndex(arg => 
      arg.startsWith('--template=')
    );
    
    if (templateFlagIndex >= 0) {
      // Extract template name from flag
      const templateArg = args[templateFlagIndex];
      const templateName = templateArg.substring(11); // Remove "--template="
      
      // Remove the template flag from args
      const otherArgs = [...args];
      otherArgs.splice(templateFlagIndex, 1);
      
      // The first remaining arg should be the filename
      const fileName = otherArgs[0];
      
      if (!fileName) return null;
      
      return { templateName, fileName };
    }
    
    return null;
  };