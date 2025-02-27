import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { TerminalOutput } from './TerminalOutput';
import { TerminalEditor } from './TerminalEditor';
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
    awaitingConfirmation: null
  });
  const [isClient, setIsClient] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Set isClient to true once the component mounts
  useEffect(() => {
    setIsClient(true);
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

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add command to history
    addToHistory({ type: 'command', content: input });

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

    // Process command
    const commandParts = input.trim().split(' ');
    const command = commandParts[0].toLowerCase();
    const args = commandParts.slice(1);

    // Clear input
    setInput('');

    try {
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
        case 'edit':
          await startEditor(args[0], command);
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
        default:
          addToHistory({
            type: 'output',
            content: `Command not found: ${command}. Type "help" for available commands.`,
          });
      }
    } catch (error) {
      addToHistory({
        type: 'output',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
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

      // Format and display files
      const filesList = files.map((file: NoteFile) => {
        const isFolder = file.is_folder;
        const icon = isFolder ? '📁' : '📄';
        return `${icon} ${file.name}${isFolder ? '/' : ''}`;
      }).join('\n');

      addToHistory({
        type: 'output',
        content: filesList,
      });
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`);
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
        content: `Directory created: ${name}`,
      });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error}`);
    }
  };

  const startEditor = async (filename: string, command: string) => {
    if (!filename) {
      addToHistory({
        type: 'output',
        content: 'Usage: new <filename> or edit <filename>',
      });
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
          content: `Loaded note: ${filename}`,
        });
      } catch (error) {
        console.log(`Failed to load note, creating new file: ${filename} (${error})`);
        
        // If error, create a new file
        setState(prev => ({
          ...prev,
          editorContent: '',
          editorMetadata: {
            tags: [],
            description: '',
          },
        }));
        
        addToHistory({
          type: 'output',
          content: `Creating new file: ${filename}`,
        });
      }
    } else {
      // New file case - set up the editor with empty content
      setState(prev => ({
        ...prev,
        editorContent: '',
        editorMetadata: {
          tags: [],
          description: '',
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
        content: `--- ${filename} ---\n\n${noteContent.content}\n\nTags: ${noteContent.tags.join(', ')}\nDescription: ${noteContent.description}`,
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
        content: `Successfully moved ${sourcePath} to ${destPath}`,
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
      const confirmMessage = `Are you sure you want to delete "${targetPath}"? This cannot be undone. (y/n)`;
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

  const handleSaveNote = async (content: string, metadata: { tags: string[], description: string }) => {
    try {
      const path = state.currentDirectory === '/' 
        ? `/${state.editorFileName}` 
        : `${state.currentDirectory}/${state.editorFileName}`;
      
      await notesService.saveNote(path, content, metadata);
      
      setMode('command');
      addToHistory({
        type: 'output',
        content: `Note saved: ${state.editorFileName}`,
      });
    } catch (error) {
      addToHistory({
        type: 'output',
        content: `Error saving note: ${error instanceof Error ? error.message : String(error)}`,
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommandSubmit(e);
                  }
                }}
              />
            </form>
          </div>
        ) : (
          <TerminalEditor 
            initialContent={state.editorContent}
            initialMetadata={state.editorMetadata}
            onSave={handleSaveNote}
            onCancel={handleCancelEdit}
          />
        )}
      </div>
    </div>
  );
};