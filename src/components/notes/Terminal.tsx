import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
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
      // Get query parameters from URL
      const params = new URLSearchParams(window.location.search);
      const pathParam = params.get('path');
      
      if (pathParam) {
        // Get the directory from the path
        const lastSlashIndex = pathParam.lastIndexOf('/');
        if (lastSlashIndex >= 0) {
          const directory = pathParam.substring(0, lastSlashIndex) || '/';
          const fileName = pathParam.substring(lastSlashIndex + 1);
          
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
          
          // Start editor with this file
          await startEditor(fileName, 'edit');
        }
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

    setMode('editor');
    setState(prev => ({
      ...prev,
      editorFileName: filename,
      editorContent: '',
      editorMetadata: {
        tags: [],
        description: '',
      },
    }));

    // If editing existing file, load its content
    if (command === 'edit') {
      const path = state.currentDirectory === '/' 
        ? `/${filename}` 
        : `${state.currentDirectory}/${filename}`;
      
      try {
        const noteContent = await notesService.getNoteContent(path);
        setState(prev => ({
          ...prev,
          editorContent: noteContent.content,
          editorMetadata: {
            tags: noteContent.tags,
            description: noteContent.description || '',
          },
        }));
      } catch (error) {
        // If error, just create a new file
        console.log(`Creating new file: ${filename}`);
      }
    }
  };

  const clearTerminal = () => {
    setState(prev => ({
      ...prev,
      history: [
        { type: 'output', content: 'Terminal cleared' },
      ],
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