import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { TerminalOutput } from './TerminalOutput';
import { TerminalEditor } from './TerminalEditor';
import { TerminalHelpGuide } from './TerminalHelpGuide';
import { notesService, NoteFile } from '../../services/notesService';

type Mode = 'command' | 'editor';

export interface TerminalState {
  currentDirectory: string;
  history: Array<{ type: 'command' | 'output'; content: string }>;
  editorContent: string;
  editorFileName: string;
  editorMetadata: {
    tags: string[];
    description: string;
  };
  awaitingConfirmation: {
    type: string;
    path: string;
  } | null;
  commandHistory: string[];
  commandHistoryIndex: number;
  commandAliases: Record<string, string>;
}

export const Terminal: React.FC = () => {
  const [mode, setMode] = useState<Mode>('command');
  const [input, setInput] = useState('');
  const [state, setState] = useState<TerminalState>({
    currentDirectory: '/',
    history: [
      { type: 'output', content: 'Welcome to Bibliotek Notes v1.0.0' },
      { type: 'output', content: 'Type "help" for available commands' },
    ],
    editorContent: '',
    editorFileName: '',
    editorMetadata: {
      tags: [],
      description: '',
    },
    awaitingConfirmation: null,
    commandHistory: [],
    commandHistoryIndex: -1,
    commandAliases: {}
  });
  const [isClient, setIsClient] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Set isClient to true once the component mounts
  useEffect(() => {
    setIsClient(true);
    
    // Load command history and aliases from localStorage
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('commandHistory');
      const savedAliases = localStorage.getItem('commandAliases');
      
      if (savedHistory) {
        try {
          const parsedHistory = JSON.parse(savedHistory);
          setState(prev => ({
            ...prev,
            commandHistory: Array.isArray(parsedHistory) ? parsedHistory : []
          }));
        } catch (e) {
          console.error('Error parsing saved command history:', e);
        }
      }
      
      if (savedAliases) {
        try {
          const parsedAliases = JSON.parse(savedAliases);
          setState(prev => ({
            ...prev,
            commandAliases: typeof parsedAliases === 'object' ? parsedAliases : {}
          }));
        } catch (e) {
          console.error('Error parsing saved command aliases:', e);
        }
      }
    }
  }, []);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [state.history]);

  // Auto-focus input when mode changes
  useEffect(() => {
    if (mode === 'command' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  // Update localStorage when command history or aliases change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('commandHistory', JSON.stringify(state.commandHistory.slice(-100)));
      localStorage.setItem('commandAliases', JSON.stringify(state.commandAliases));
    }
  }, [state.commandHistory, state.commandAliases]);

  // Only use router on the client side
  useEffect(() => {
    if (!isClient) return;
  
    const handleQueryParams = async () => {
      try {
        // Get query parameters from URL
        const params = new URLSearchParams(window.location.search);
        const pathParam = params.get('path');
        
        if (pathParam) {
          console.log("Found path parameter:", pathParam);
          
          // Get the directory from the path
          const lastSlashIndex = pathParam.lastIndexOf('/');
          if (lastSlashIndex >= 0) {
            const directory = pathParam.substring(0, lastSlashIndex) || '/';
            const fileName = pathParam.substring(lastSlashIndex + 1);
            
            console.log(`Directory: ${directory}, Filename: ${fileName}`);
            
            // Update the current directory
            setState(prev => ({
              ...prev,
              currentDirectory: directory
            }));
            
            // Add message to history
            addToHistory({ 
              type: 'output', 
              content: `Changed directory to ${directory}` 
            });
            
            // First try to get content to see if the file exists
            try {
              const path = directory === '/' 
                ? `/${fileName}` 
                : `${directory}/${fileName}`;
              
              console.log("Attempting to load note from path:", path);
              const noteContent = await notesService.getNoteContent(path);
              
              if (noteContent) {
                console.log("Successfully loaded note content:", noteContent);
                
                // Start editor with this file
                setMode('editor');
                setState(prev => ({
                  ...prev,
                  editorFileName: fileName,
                  editorContent: noteContent.content || '',
                  editorMetadata: {
                    tags: Array.isArray(noteContent.tags) ? noteContent.tags : [],
                    description: noteContent.description || '',
                  },
                }));
                
                addToHistory({
                  type: 'output',
                  content: `Loaded note: ${fileName}`,
                });
              }
            } catch (error) {
              console.error("Error loading note:", error);
              // Start with a new file instead
              setMode('editor');
              setState(prev => ({
                ...prev,
                editorFileName: fileName,
                editorContent: '',
                editorMetadata: {
                  tags: [],
                  description: '',
                },
              }));
              
              addToHistory({
                type: 'output',
                content: `Creating new file: ${fileName}`,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error handling URL parameter:', error);
        addToHistory({
          type: 'output',
          content: `Error loading note: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    };
    
    handleQueryParams();
  }, [isClient]); // Only run when isClient changes to true

  const addToHistory = (entry: { type: 'command' | 'output'; content: string }) => {
    setState(prev => ({
      ...prev,
      history: [...prev.history, entry],
    }));
  };

  const addToCommandHistory = (command: string) => {
    if (!command.trim()) return;
    
    setState(prev => {
      // Only add the command if it's different from the last one
      const lastCommand = prev.commandHistory.length > 0 
        ? prev.commandHistory[prev.commandHistory.length - 1] 
        : null;
      
      if (command !== lastCommand) {
        return {
          ...prev,
          commandHistory: [...prev.commandHistory, command],
          commandHistoryIndex: prev.commandHistory.length + 1
        };
      }
      
      return {
        ...prev,
        commandHistoryIndex: prev.commandHistory.length
      };
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle command history navigation with up/down arrow keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      
      setState(prev => {
        const newIndex = Math.max(0, prev.commandHistoryIndex - 1);
        if (newIndex < prev.commandHistory.length) {
          setInput(prev.commandHistory[newIndex]);
          return {
            ...prev,
            commandHistoryIndex: newIndex
          };
        }
        return prev;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      
      setState(prev => {
        const newIndex = Math.min(prev.commandHistory.length, prev.commandHistoryIndex + 1);
        if (newIndex === prev.commandHistory.length) {
          setInput('');
          return {
            ...prev,
            commandHistoryIndex: newIndex
          };
        } else if (newIndex < prev.commandHistory.length) {
          setInput(prev.commandHistory[newIndex]);
          return {
            ...prev,
            commandHistoryIndex: newIndex
          };
        }
        return prev;
      });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabCompletion();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommandSubmit(e);
    }
  };

  const handleTabCompletion = async () => {
    if (!input.trim()) return;
    
    const words = input.trim().split(' ');
    const currentCommand = words[0].toLowerCase();
    
    // Complete commands if only the command is being typed
    if (words.length === 1) {
      const availableCommands = [
        'help', 'ls', 'cd', 'mkdir', 'new', 'edit', 'open', 
        'move', 'delete', 'rm', 'clear', 'search', 'alias'
      ];
      
      // Add user-defined aliases to the available commands
      const aliasCommands = Object.keys(state.commandAliases);
      const allCommands = [...availableCommands, ...aliasCommands];
      
      // Filter commands that start with the current input
      const matchingCommands = allCommands.filter(cmd => 
        cmd.startsWith(currentCommand)
      );
      
      if (matchingCommands.length === 1) {
        // If only one match, autocomplete it
        setInput(matchingCommands[0]);
      } else if (matchingCommands.length > 1) {
        // If multiple matches, show them as suggestions
        addToHistory({
          type: 'output',
          content: `Matching commands: ${matchingCommands.join(', ')}`
        });
      }
      
      return;
    }
    
    // Path completion for commands that take file/directory paths
    if (['cd', 'edit', 'open', 'new', 'move', 'delete', 'rm'].includes(currentCommand)) {
      let pathArg = words[words.length - 1];
      let basePath = state.currentDirectory;
      
      // If the path is absolute, use it as is, otherwise combine with current directory
      if (pathArg.startsWith('/')) {
        const lastSlash = pathArg.lastIndexOf('/');
        if (lastSlash > 0) {
          basePath = pathArg.substring(0, lastSlash);
          pathArg = pathArg.substring(lastSlash + 1);
        } else {
          basePath = '/';
          pathArg = pathArg.substring(1);
        }
      } else {
        // For relative paths, check if there's a directory part
        const lastSlash = pathArg.lastIndexOf('/');
        if (lastSlash >= 0) {
          const relativeDir = pathArg.substring(0, lastSlash);
          pathArg = pathArg.substring(lastSlash + 1);
          
          // Combine with current directory
          basePath = basePath === '/' 
            ? `/${relativeDir}` 
            : `${basePath}/${relativeDir}`;
        }
      }
      
      try {
        // List files in the directory
        const files = await notesService.listFiles(basePath);
        
        // Filter files that match the current path argument
        const matchingFiles = files.filter(file => 
          file.name.startsWith(pathArg)
        );
        
        if (matchingFiles.length === 1) {
          // If only one match, autocomplete it
          const file = matchingFiles[0];
          const newPathArg = file.name + (file.is_folder ? '/' : '');
          
          // Replace the last word with the completed path
          words[words.length - 1] = words[words.length - 1].includes('/') 
            ? words[words.length - 1].substring(0, words[words.length - 1].lastIndexOf('/') + 1) + newPathArg
            : newPathArg;
          
          setInput(words.join(' '));
        } else if (matchingFiles.length > 1) {
          // If multiple matches, show them as suggestions
          const suggestions = matchingFiles.map(file => 
            `${file.name}${file.is_folder ? '/' : ''}`
          );
          
          addToHistory({
            type: 'output',
            content: `Matching files: ${suggestions.join(', ')}`
          });
        }
      } catch (error) {
        console.error('Error during tab completion:', error);
      }
    }
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add command to history
    addToHistory({ type: 'command', content: input });
    addToCommandHistory(input);

    // Check if we're waiting for a confirmation
    if (state.awaitingConfirmation) {
      const response = input.trim().toLowerCase();
      
      if (response === 'y' || response === 'yes') {
        try {
          if (state.awaitingConfirmation.type === 'delete') {
            // Execute the actual delete operation
            await notesService.deleteFile(state.awaitingConfirmation.path);
            addToHistory({
              type: 'output',
              content: `Successfully deleted ${state.awaitingConfirmation.path}`,
            });
          }
          // Reset the confirmation state
          setState(prev => ({
            ...prev,
            awaitingConfirmation: null
          }));
        } catch (error) {
          addToHistory({
            type: 'output',
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          });
          setState(prev => ({
            ...prev,
            awaitingConfirmation: null
          }));
        }
      } else if (response === 'n' || response === 'no') {
        addToHistory({
          type: 'output',
          content: 'Operation cancelled.',
        });
        // Reset the confirmation state
        setState(prev => ({
          ...prev,
          awaitingConfirmation: null
        }));
      } else {
        addToHistory({
          type: 'output',
          content: 'Please respond with "y" or "n".',
        });
      }
      
      // Clear input and return early
      setInput('');
      return;
    }

    // Handle command chaining
    if (input.includes(';')) {
      const commands = input.split(';').map(cmd => cmd.trim()).filter(Boolean);
      // Clear input before processing
      setInput('');
      
      // Process commands sequentially
      for (const cmd of commands) {
        await processCommand(cmd);
      }
      return;
    }

    // Process single command
    setInput('');
    await processCommand(input);
  };

  const processCommand = async (commandInput: string) => {
    // Process command
    const commandParts = commandInput.trim().split(' ');
    let command = commandParts[0].toLowerCase();
    const args = commandParts.slice(1);

    // Check if the command is an alias and replace it
    if (state.commandAliases[command]) {
      const aliasedCommand = state.commandAliases[command];
      // Replace the alias with its definition and re-parse
      const newCommandParts = aliasedCommand.split(' ');
      command = newCommandParts[0].toLowerCase();
      // Combine alias args with original args
      const aliasArgs = newCommandParts.slice(1);
      const combinedArgs = [...aliasArgs, ...args];
      
      // Log the expanded command
      addToHistory({
        type: 'output',
        content: `Alias expanded: ${command} ${combinedArgs.join(' ')}`,
      });
      
      try {
        await executeCommand(command, combinedArgs);
      } catch (error) {
        addToHistory({
          type: 'output',
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      return;
    }

    try {
      await executeCommand(command, args);
    } catch (error) {
      addToHistory({
        type: 'output',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  // Define searchNotes function before it's used
  const searchNotes = async (args: string[]) => {
    if (args.length === 0) {
      addToHistory({
        type: 'output',
        content: 'Usage: search <term> [--tag=<tag>] [--path=<path>]',
      });
      return;
    }
    
    // Parse search arguments
    let searchTerm = '';
    let tagFilter: string | null = null;
    let pathFilter: string | null = null;
    
    for (const arg of args) {
      if (arg.startsWith('--tag=')) {
        tagFilter = arg.substring(6);
      } else if (arg.startsWith('--path=')) {
        pathFilter = arg.substring(7);
      } else if (!searchTerm) {
        searchTerm = arg;
      } else {
        searchTerm += ' ' + arg;
      }
    }
    
    addToHistory({
      type: 'output',
      content: `Searching for "${searchTerm}"${tagFilter ? ` with tag "${tagFilter}"` : ''}${pathFilter ? ` in path "${pathFilter}"` : ''}...`,
    });
    
    try {
      // Implement search functionality by listing all files recursively
      // and checking their contents
      const results = await searchAllNotes(searchTerm, tagFilter, pathFilter);
      
      if (results.length === 0) {
        addToHistory({
          type: 'output',
          content: 'No matching notes found.',
        });
        return;
      }
      
      // Format search results
      const formattedResults = results.map(result => 
        `<span class="search-result-path">${result.path}</span>\n` +
        `<span class="search-result-preview">${result.preview}</span>\n` +
        `<span class="search-result-metadata">Tags: ${result.tags.join(', ')}</span>`
      ).join('\n\n');
      
      addToHistory({
        type: 'output',
        content: `<span class="search-results-header">Found ${results.length} matching notes:</span>\n\n${formattedResults}`,
      });
    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  };

  // Helper function to search all notes
  const searchAllNotes = async (
    term: string, 
    tagFilter: string | null, 
    pathFilter: string | null
  ): Promise<Array<{
    path: string;
    preview: string;
    tags: string[];
  }>> => {
    // This is a simplified implementation. In a real application,
    // you would want to implement this on the backend for efficiency.
    // For now, we'll simulate by searching in a few directories
    
    const results: Array<{
      path: string;
      preview: string;
      tags: string[];
    }> = [];
    
    // Start from either the path filter or current directory
    const startPath = pathFilter || state.currentDirectory;
    
    // List files in the starting directory
    try {
      await searchDirectory(startPath, term, tagFilter, results);
    } catch (error) {
      console.error(`Error searching in ${startPath}:`, error);
    }
    
    return results;
  };

  // Helper function to search a directory recursively
  const searchDirectory = async (
    path: string,
    term: string,
    tagFilter: string | null,
    results: Array<{
      path: string;
      preview: string;
      tags: string[];
    }>
  ) => {
    try {
      const files = await notesService.listFiles(path);
      
      // Check each file in the directory
      for (const file of files) {
        if (file.is_folder) {
          // Recursively search subdirectories
          const subPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
          await searchDirectory(subPath, term, tagFilter, results);
        } else {
          // Check if it's a note file (not a link)
          if (!file.url || file.url.trim() === '') {
            const filePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
            
            try {
              const noteContent = await notesService.getNoteContent(filePath);
              
              // Apply tag filter if specified
              if (tagFilter && (!noteContent.tags || !noteContent.tags.some(tag => 
                tag.toLowerCase().includes(tagFilter.toLowerCase())
              ))) {
                continue;
              }
              
              // Check if content matches search term
              if (noteContent.content.toLowerCase().includes(term.toLowerCase()) ||
                  file.name.toLowerCase().includes(term.toLowerCase())) {
                
                // Create a preview by finding and highlighting the context around the match
                let preview = '';
                const lowerContent = noteContent.content.toLowerCase();
                const termIdx = lowerContent.indexOf(term.toLowerCase());
                
                if (termIdx >= 0) {
                  // Get context (50 chars before and after)
                  const startIdx = Math.max(0, termIdx - 50);
                  const endIdx = Math.min(noteContent.content.length, termIdx + term.length + 50);
                  preview = noteContent.content.substring(startIdx, endIdx);
                  
                  // Add ellipsis if truncated
                  if (startIdx > 0) preview = '...' + preview;
                  if (endIdx < noteContent.content.length) preview = preview + '...';
                  
                  // Highlight the matching term
                  const regex = new RegExp(term, 'gi');
                  preview = preview.replace(regex, match => `<span class="search-highlight">${match}</span>`);
                } else {
                  // If we matched on filename but not content, just take the first 100 chars
                  preview = noteContent.content.substring(0, 100) + (noteContent.content.length > 100 ? '...' : '');
                }
                
                results.push({
                  path: filePath,
                  preview,
                  tags: noteContent.tags || []
                });
              }
            } catch (error) {
              console.error(`Error searching file ${filePath}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error listing files in ${path}:`, error);
    }
  };

  // Define handleTemplateCommand before it's used
  const handleTemplateCommand = async (args: string[]) => {
    // Import template service
    const { getTemplates, isBuiltInTemplate, saveTemplate, deleteTemplate, getTemplateNames } = 
      await import('../../services/templateService');
    
    if (args.length === 0) {
      // List all available templates
      const templates = getTemplates();
      const templateList = Object.entries(templates).map(([name, template]) => {
        const isBuiltIn = isBuiltInTemplate(name);
        return `${name} - ${template.description} ${isBuiltIn ? '(built-in)' : '(custom)'}`;
      }).join('\n');
      
      addToHistory({
        type: 'output',
        content: `Available templates:\n${templateList}\n\nUse 'template save <name>' to save the current note as a template.\nUse 'template delete <name>' to remove a custom template.`,
      });
      return;
    }
    
    const subCommand = args[0].toLowerCase();
    
    if (subCommand === 'save') {
      if (args.length < 2) {
        addToHistory({
          type: 'output',
          content: 'Usage: template save <template_name> [description]',
        });
        return;
      }
      
      // Check if we're in command mode (can't save a template from command mode)
      if (mode === 'command') {
        addToHistory({
          type: 'output',
          content: '<span class="error">Cannot save template: You must be editing a note first.</span>',
        });
        return;
      }
      
      const templateName = args[1];
      
      // Get description if provided
      const description = args.slice(2).join(' ') || `Custom template: ${templateName}`;
      
      // Check if trying to overwrite a built-in template
      if (isBuiltInTemplate(templateName)) {
        addToHistory({
          type: 'output',
          content: `<span class="error">Cannot overwrite built-in template: ${templateName}</span>`,
        });
        return;
      }
      
      // Create template object
      const template = {
        name: templateName,
        content: state.editorContent,
        tags: state.editorMetadata.tags,
        description
      };
      
      // Save the template
      const success = saveTemplate(templateName, template);
      
      if (success) {
        addToHistory({
          type: 'output',
          content: `<span class="success">Template saved: ${templateName}</span>`,
        });
      } else {
        addToHistory({
          type: 'output',
          content: `<span class="error">Failed to save template: ${templateName}</span>`,
        });
      }
    } else if (subCommand === 'delete' || subCommand === 'rm') {
      if (args.length < 2) {
        addToHistory({
          type: 'output',
          content: 'Usage: template delete <template_name>',
        });
        return;
      }
      
      const templateName = args[1];
      
      // Check if trying to delete a built-in template
      if (isBuiltInTemplate(templateName)) {
        addToHistory({
          type: 'output',
          content: `<span class="error">Cannot delete built-in template: ${templateName}</span>`,
        });
        return;
      }
      
      // Delete the template
      const success = deleteTemplate(templateName);
      
      if (success) {
        addToHistory({
          type: 'output',
          content: `<span class="success">Template deleted: ${templateName}</span>`,
        });
      } else {
        addToHistory({
          type: 'output',
          content: `<span class="error">Template not found: ${templateName}</span>`,
        });
      }
    } else {
      addToHistory({
        type: 'output',
        content: 'Unknown template command. Available commands: save, delete',
      });
    }
  };

  const executeCommand = async (command: string, args: string[]) => {
    switch (command) {
      case 'help':
        showHelp();
        break;
      case 'ls':
        await listFiles(args[0]);
        break;
      case 'cd':
        changeDirectory(args[0]);
        break;
      case 'mkdir':
        await createDirectory(args[0]);
        break;
      case 'new':
        await startEditor(args.join(' '), command);
        break;
      case 'edit':
        await startEditor(args.join(' '), command);
        break;
      case 'open':
        await openNote(args[0]);
        break;
      case 'move':
        await moveFile(args[0], args[1]);
        break;
      case 'delete':
      case 'rm':
        await deleteFile(args[0]);
        break;
      case 'clear':
        clearTerminal();
        break;
      case 'alias':
        handleAlias(args);
        break;
      case 'search':
        await searchNotes(args);
        break;
      case 'template':
        await handleTemplateCommand(args);
        break;
      default:
        addToHistory({
          type: 'output',
          content: `Command not found: ${command}. Type "help" for available commands.`,
        });
    }
  };

  const showHelp = () => {
    addToHistory({
      type: 'output',
      content: `
Available commands:
  help              Show this help message
  ls [path]         List files in current or specified directory
  cd <path>         Change current directory
  mkdir <name>      Create a new directory
  new <filename>    Create a new note
  edit <filename>   Edit an existing note
  open <filename>   Open and view a note (read-only)
  move <src> <dst>  Move a file or directory to a new location
  delete <path>     Delete a file or directory
  rm <path>         Alias for delete
  clear             Clear terminal history
  alias [name] [definition]  Manage command aliases
  search <term> [--tag=<tag>] [--path=<path>]  Search for notes
  
Tips:
  • Use arrow keys (↑/↓) to navigate command history
  • Use Tab key for command and path auto-completion
  • Use semicolons (;) to chain multiple commands
`.trim(),
    });
  };

  const listFiles = async (path?: string) => {
    try {
      const targetPath = path || state.currentDirectory;
      const files = await notesService.listFiles(targetPath);
      
      if (files.length === 0) {
        addToHistory({
          type: 'output',
          content: 'Directory is empty',
        });
        return;
      }

      // Format and display files with colors
      const filesList = files.map((file: NoteFile) => {
        const isFolder = file.is_folder;
        const icon = isFolder ? '📁' : '📄';
        const colorClass = isFolder ? 'folder' : getFileColorClass(file.name);
        return `<span class="${colorClass}">${icon} ${file.name}${isFolder ? '/' : ''}</span>`;
      }).join('\n');

      addToHistory({
        type: 'output',
        content: filesList,
      });
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`);
    }
  };

  // Helper function to get color class based on file extension
  const getFileColorClass = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'md':
        return 'markdown-file';
      case 'txt':
        return 'text-file';
      case 'json':
        return 'json-file';
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return 'code-file';
      default:
        return 'regular-file';
    }
  };

  const changeDirectory = (path: string) => {
    if (!path) {
      addToHistory({
        type: 'output',
        content: 'Usage: cd <path>',
      });
      return;
    }

    // Handle relative and absolute paths
    let newPath: string;
    if (path.startsWith('/')) {
      newPath = path;
    } else if (path === '..') {
      // Go up one level
      const pathParts = state.currentDirectory.split('/').filter(Boolean);
      pathParts.pop();
      newPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/');
    } else {
      // Append to current path
      newPath = state.currentDirectory === '/' 
        ? `/${path}` 
        : `${state.currentDirectory}/${path}`;
    }

    // Normalize path (remove double slashes, etc.)
    newPath = newPath.replace(/\/+/g, '/');
    if (newPath !== '/' && newPath.endsWith('/')) {
      newPath = newPath.slice(0, -1);
    }

    setState(prev => ({
      ...prev,
      currentDirectory: newPath,
    }));

    addToHistory({
      type: 'output',
      content: `Changed directory to ${newPath}`,
    });
  };

  const createDirectory = async (name: string) => {
    if (!name) {
      addToHistory({
        type: 'output',
        content: 'Usage: mkdir <name>',
      });
      return;
    }

    try {
      const path = state.currentDirectory === '/' 
        ? `/${name}` 
        : `${state.currentDirectory}/${name}`;
      
      await notesService.createDirectory(path);
      
      addToHistory({
        type: 'output',
        content: `<span class="success">Directory created: ${name}</span>`,
      });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error}`);
    }
  };

  const startEditor = async (filenameArg: string, command: string) => {
    // Import template service if needed
    const { parseTemplateArgs, getTemplate, getTemplateNames } = await import('../../services/templateService');
    
    // Split the argument into parts for template handling
    const args = filenameArg ? filenameArg.split(' ') : [];
    
    // Check for template syntax in the 'new' command
    let filename = filenameArg;
    let templateContent = '';
    let templateTags: string[] = [];
    let templateDescription = '';
    
    if (command === 'new' && args.length > 0) {
      // Try to parse template arguments
      const templateArgs = parseTemplateArgs(args);
      
      if (templateArgs) {
        // Template flag was found
        const { templateName, fileName } = templateArgs;
        filename = fileName;
        
        // Get the template
        const template = getTemplate(templateName);
        
        if (template) {
          templateContent = template.content;
          templateTags = template.tags;
          templateDescription = template.description;
          
          addToHistory({
            type: 'output',
            content: `<span class="success">Using template: ${template.name}</span>`,
          });
        } else {
          addToHistory({
            type: 'output',
            content: `<span class="error">Template not found: ${templateName}</span>`,
          });
          
          // Show available templates
          const availableTemplates = getTemplateNames();
          addToHistory({
            type: 'output',
            content: `Available templates: ${availableTemplates.join(', ')}`,
          });
          
          return;
        }
      }
    }
    
    if (!filename) {
      if (command === 'new') {
        addToHistory({
          type: 'output',
          content: 'Usage: new <filename> [--template=<template_name>]',
        });
        
        // Show available templates
        const availableTemplates = getTemplateNames();
        addToHistory({
          type: 'output',
          content: `Available templates: ${availableTemplates.join(', ')}`,
        });
      } else {
        addToHistory({
          type: 'output',
          content: 'Usage: edit <filename>',
        });
      }
      return;
    }
  
    const path = state.currentDirectory === '/' 
      ? `/${filename}` 
      : `${state.currentDirectory}/${filename}`;
    
    // Set initial editor state
    setMode('editor');
    setState(prev => ({
      ...prev,
      editorFileName: filename,
      // Don't reset these to empty initially - let them stay with previous values until we update them below
      // This helps prevent flickering to empty state while loading
    }));
    
    if (command === 'edit') {
      try {
        console.log(`Loading note content from: ${path}`);
        const noteContent = await notesService.getNoteContent(path);
        
        console.log("Content loaded successfully:", noteContent);
        
        // Only update the state after successfully loading the content
        setState(prev => ({
          ...prev,
          editorContent: noteContent.content || '',
          editorMetadata: {
            tags: Array.isArray(noteContent.tags) ? noteContent.tags : [],
            description: noteContent.description || '',
          },
        }));
        
        addToHistory({
          type: 'output',
          content: `<span class="success">Loaded note: ${filename}</span>`,
        });
      } catch (error) {
        console.log(`Failed to load note, creating new file: ${filename} (${error})`);
        
        // If error, create a new file
        setState(prev => ({
          ...prev,
          editorContent: templateContent || '',
          editorMetadata: {
            tags: templateTags || [],
            description: templateDescription || '',
          },
        }));
        
        addToHistory({
          type: 'output',
          content: `Creating new file: ${filename}`,
        });
      }
    } else {
      // New file case - set up the editor with template content if specified
      setState(prev => ({
        ...prev,
        editorContent: templateContent || '',
        editorMetadata: {
          tags: templateTags || [],
          description: templateDescription || '',
        },
      }));
    }
  };

  const openNote = async (filename: string) => {
    if (!filename) {
      addToHistory({
        type: 'output',
        content: 'Usage: open <filename>',
      });
      return;
    }

    try {
      const path = state.currentDirectory === '/' 
        ? `/${filename}` 
        : `${state.currentDirectory}/${filename}`;
      
      const noteContent = await notesService.getNoteContent(path);
      
      // Display note content in terminal output
      addToHistory({
        type: 'output',
        content: `<span class="note-header">--- ${filename} ---</span>\n\n${noteContent.content}\n\n<span class="note-metadata">Tags: ${noteContent.tags.join(', ')}\nDescription: ${noteContent.description}</span>`,
      });
    } catch (error) {
      throw new Error(`Failed to open note: ${error}`);
    }
  };

  const moveFile = async (source: string, destination: string) => {
    if (!source || !destination) {
      addToHistory({
        type: 'output',
        content: 'Usage: move <source_path> <destination_path>',
      });
      return;
    }
    
    try {
      // Convert to absolute paths if not already
      let sourcePath = source;
      if (!sourcePath.startsWith('/')) {
        sourcePath = state.currentDirectory === '/' 
          ? `/${sourcePath}` 
          : `${state.currentDirectory}/${sourcePath}`;
      }
      
      let destPath = destination;
      if (!destPath.startsWith('/')) {
        destPath = state.currentDirectory === '/' 
          ? `/${destPath}` 
          : `${state.currentDirectory}/${destPath}`;
      }
      
      // Normalize paths
      sourcePath = sourcePath.replace(/\/+/g, '/');
      destPath = destPath.replace(/\/+/g, '/');
      
      // If destination is a directory, append the source filename
      if (destPath.endsWith('/')) {
        const sourceFileName = sourcePath.split('/').pop();
        destPath = `${destPath}${sourceFileName}`;
      }
      
      // Call the moveFile API
      await notesService.moveFile(sourcePath, destPath);
      
      addToHistory({
        type: 'output',
        content: `<span class="success">Successfully moved ${sourcePath} to ${destPath}</span>`,
      });
    } catch (error) {
      throw new Error(`Failed to move file: ${error}`);
    }
  };

  const deleteFile = async (path: string) => {
    if (!path) {
      addToHistory({
        type: 'output',
        content: 'Usage: delete <path> or rm <path>',
      });
      return;
    }
    
    try {
      // Convert to absolute path if not already
      let targetPath = path;
      if (!targetPath.startsWith('/')) {
        targetPath = state.currentDirectory === '/' 
          ? `/${targetPath}` 
          : `${state.currentDirectory}/${targetPath}`;
      }
      
      // Normalize path
      targetPath = targetPath.replace(/\/+/g, '/');
      
      // Confirm deletion
      const confirmMessage = `<span class="warning">Are you sure you want to delete "${targetPath}"? This cannot be undone. (y/n)</span>`;
      addToHistory({
        type: 'output',
        content: confirmMessage,
      });
      
      // Set a flag to wait for confirmation
      setState(prev => ({
        ...prev,
        awaitingConfirmation: {
          type: 'delete',
          path: targetPath,
        }
      }));
      
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  };

  const clearTerminal = () => {
    setState(prev => ({
      ...prev,
      history: [
        { type: 'output', content: 'Terminal cleared' },
      ],
      awaitingConfirmation: null
    }));
  };

  const handleAlias = (args: string[]) => {
    // List all aliases if no arguments provided
    if (args.length === 0) {
      if (Object.keys(state.commandAliases).length === 0) {
        addToHistory({
          type: 'output',
          content: 'No aliases defined.',
        });
        return;
      }
      
      const aliasesList = Object.entries(state.commandAliases)
        .map(([alias, command]) => `${alias} => ${command}`)
        .join('\n');
      
      addToHistory({
        type: 'output',
        content: `Defined aliases:\n${aliasesList}`,
      });
      return;
    }
    
    // Remove an alias
    if (args[0] === 'rm' || args[0] === 'remove') {
      const aliasToRemove = args[1];
      if (!aliasToRemove) {
        addToHistory({
          type: 'output',
          content: 'Usage: alias rm <alias_name>',
        });
        return;
      }
      
      setState(prev => {
        const newAliases = { ...prev.commandAliases };
        if (newAliases[aliasToRemove]) {
          delete newAliases[aliasToRemove];
          addToHistory({
            type: 'output',
            content: `<span class="success">Removed alias: ${aliasToRemove}</span>`,
          });
        } else {
          addToHistory({
            type: 'output',
            content: `<span class="error">Alias not found: ${aliasToRemove}</span>`,
          });
        }
        
        return {
          ...prev,
          commandAliases: newAliases
        };
      });
      
      return;
    }
    
    // Add or update an alias
    const aliasName = args[0];
    const aliasCommand = args.slice(1).join(' ');
    
    if (!aliasCommand) {
      addToHistory({
        type: 'output',
        content: 'Usage: alias <alias_name> <command>',
      });
      return;
    }
    
    setState(prev => ({
      ...prev,
      commandAliases: {
        ...prev.commandAliases,
        [aliasName]: aliasCommand
      }
    }));
    
    addToHistory({
      type: 'output',
      content: `<span class="success">Alias created: ${aliasName} => ${aliasCommand}</span>`,
    });
  };

// Update the handleSaveNote function in Terminal.tsx
const handleSaveNote = async (newFilename: string, content: string, metadata: { tags: string[], description: string }) => {
  try {
    const currentPath = state.currentDirectory === '/' 
      ? `/${state.editorFileName}` 
      : `${state.currentDirectory}/${state.editorFileName}`;
    
    // Check if the filename has been changed
    if (newFilename !== state.editorFileName) {
      // Create path for the new file
      const newPath = state.currentDirectory === '/' 
        ? `/${newFilename}` 
        : `${state.currentDirectory}/${newFilename}`;
      
      // First save to the new location
      await notesService.saveNote(newPath, content, metadata);
      
      // Then delete the old file if it exists
      try {
        // Only attempt to delete if this wasn't a new file
        const files = await notesService.listFiles(state.currentDirectory);
        const fileExists = files.some(file => file.name === state.editorFileName);
        
        if (fileExists) {
          await notesService.deleteFile(currentPath);
        }
      } catch (error) {
        console.error('Error deleting old file:', error);
        // Continue even if delete failed
      }
      
      // Update the state with the new filename
      setState(prev => ({
        ...prev,
        editorFileName: newFilename
      }));
      
      setMode('command');
      addToHistory({
        type: 'output',
        content: `<span class="success">Note renamed and saved: ${state.editorFileName} → ${newFilename}</span>`,
      });
    } else {
      // Just save to the current path if filename hasn't changed
      await notesService.saveNote(currentPath, content, metadata);
      
      setMode('command');
      addToHistory({
        type: 'output',
        content: `<span class="success">Note saved: ${state.editorFileName}</span>`,
      });
    }
  } catch (error) {
    addToHistory({
      type: 'output',
      content: `<span class="error">Error saving note: ${error instanceof Error ? error.message : String(error)}</span>`,
    });
    setMode('command');
  }
};

  const handleCancelEdit = () => {
    setMode('command');
    addToHistory({
      type: 'output',
      content: 'Edit canceled',
    });
  };

// Render terminal or editor based on current mode
return (
  <div className="neo-brutalist-card w-full">
    <div className="neo-brutalist-content relative">
      <div className="flex items-center justify-between bg-[#ff6b6b] text-white px-4 py-2 mb-4 border-b-2 border-black">
        <h2 className="font-monument text-xl">
          {mode === 'command' ? `Terminal: ${state.currentDirectory}` : `Editing: ${state.editorFileName}`}
        </h2>
        <div className="text-xs font-mono">bibliotek@notes:~</div>
      </div>

      <div className="flex">
        <TerminalHelpGuide />
        
        <div className="flex-1">

{mode === 'command' ? (
  <div className="flex flex-col h-[70vh]">
    <div
      ref={terminalRef}
      className="flex-1 overflow-auto p-4 font-mono text-sm whitespace-pre-wrap"
    >
      <TerminalOutput history={state.history} />
    </div>
    <form onSubmit={handleCommandSubmit} className="flex items-center border-t-2 border-black p-2">
      <span className="text-[#ff6b6b] font-bold mr-2">$</span>
      <Textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="flex-1 resize-none overflow-hidden border-none focus-visible:ring-0 font-mono"
        rows={1}
        placeholder="Type a command..."
        onKeyDown={handleKeyDown}
      />
    </form>
  </div>
) : (
  <TerminalEditor
    initialContent={state.editorContent}
    initialFilename={state.editorFileName}
    initialMetadata={state.editorMetadata}
    onSave={handleSaveNote}
    onCancel={handleCancelEdit}
  />
)}
        </div>
      </div>
    </div>
    
    {/* CSS for terminal text styling */}
    <style jsx global>{`
      .folder {
        color: #4169E1; /* Royal Blue for folders */
        font-weight: bold;
      }
      .markdown-file {
        color: #228B22; /* Forest Green for markdown */
      }
      .text-file {
        color: #000000; /* Black for text files */
      }
      .json-file {
        color: #FF8C00; /* Dark Orange for JSON */
      }
      .code-file {
        color: #9932CC; /* Dark Orchid for code files */
      }
      .regular-file {
        color: #696969; /* Dim Gray for regular files */
      }
      .success {
        color: #228B22; /* Forest Green for success messages */
      }
      .error {
        color: #B22222; /* Firebrick for errors */
      }
      .warning {
        color: #FF8C00; /* Dark Orange for warnings */
      }
      .note-header {
        color: #1E90FF; /* Dodger Blue for note headers */
        font-weight: bold;
      }
      .note-metadata {
        color: #708090; /* Slate Gray for metadata */
        font-style: italic;
      }
      .search-results-header {
        color: #4169E1; /* Royal Blue for search headers */
        font-weight: bold;
      }
      .search-result-path {
        color: #228B22; /* Forest Green for file paths */
        font-weight: bold;
      }
      .search-result-preview {
        color: #000000; /* Black for preview text */
      }
      .search-result-metadata {
        color: #708090; /* Slate Gray for metadata */
        font-style: italic;
      }
      .search-highlight {
        background-color: #FFFF00; /* Yellow highlight for search matches */
        color: #000000;
        font-weight: bold;
      }
    `}</style>
  </div>
);}