import React, { useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CommandSection {
  title: string;
  commands: CommandInfo[];
}

interface CommandInfo {
  name: string;
  syntax: string[];
  description: string;
  examples: Example[];
  tips: string[];
  related?: string[];
}

interface Example {
  command: string;
  output: string;
}

export const TerminalHelpGuide: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleGuide = () => {
    setIsExpanded(!isExpanded);
  };

  // Define command sections with detailed info
  const commandSections: CommandSection[] = [
    {
      title: "File Management",
      commands: [
        {
          name: "ls",
          syntax: ["ls", "ls [path]"],
          description: "List files in current or specified directory",
          examples: [
            {
              command: "$ ls",
              output: "📁 projects/\n📄 welcome.md\n📄 todo.md"
            },
            {
              command: "$ ls /projects",
              output: "📁 web/\n📁 notes/\n📄 ideas.md"
            }
          ],
          tips: [
            "Colors indicate file types: blue for folders, green for markdown",
            "Use with paths to explore without changing directories"
          ],
          related: ["cd", "mkdir"]
        },
        {
          name: "cd",
          syntax: ["cd <path>", "cd ..", "cd /"],
          description: "Change current directory",
          examples: [
            {
              command: "$ cd projects",
              output: "Changed directory to /projects"
            },
            {
              command: "$ cd ..",
              output: "Changed directory to /"
            }
          ],
          tips: [
            "Use cd .. to move up one directory",
            "Use cd / to return to root directory",
            "Absolute paths start with /, relative paths don't"
          ],
          related: ["ls", "mkdir"]
        },
        {
          name: "mkdir",
          syntax: ["mkdir <name>"],
          description: "Create a new directory",
          examples: [
            {
              command: "$ mkdir projects",
              output: "Directory created: projects"
            }
          ],
          tips: [
            "Directory names should avoid special characters",
            "Will create at current location unless absolute path given"
          ],
          related: ["cd", "ls"]
        },
        {
          name: "move",
          syntax: ["move <source> <destination>"],
          description: "Move or rename files and directories",
          examples: [
            {
              command: "$ move notes.md /projects/",
              output: "Successfully moved /notes.md to /projects/notes.md"
            },
            {
              command: "$ move old.md new.md",
              output: "Successfully moved /old.md to /new.md"
            }
          ],
          tips: [
            "Use to rename a file by keeping it in the same directory",
            "Moving to a directory keeps the original filename",
            "Paths can be relative or absolute"
          ],
          related: ["delete"]
        },
        {
          name: "delete / rm",
          syntax: ["delete <path>", "rm <path>"],
          description: "Delete a file or directory",
          examples: [
            {
              command: "$ delete notes.md",
              output: "Are you sure you want to delete \"/notes.md\"? This cannot be undone. (y/n)\n$ y\nSuccessfully deleted /notes.md"
            }
          ],
          tips: [
            "Will ask for confirmation before deleting",
            "Answer y (yes) or n (no) when prompted",
            "rm is a shorter alias for delete"
          ],
          related: ["move"]
        }
      ]
    },
    {
      title: "Note Operations",
      commands: [
        {
          name: "new",
          syntax: [
            "new <filename>", 
            "new <filename> --template=<template_name>"
          ],
          description: "Create a new note file and open it in the editor",
          examples: [
            {
              command: "$ new meeting.md",
              output: "Creating new file: meeting.md"
            },
            {
              command: "$ new project.md --template=project",
              output: "Using template: project\nCreating new file: project.md"
            }
          ],
          tips: [
            "Use templates to start with predefined content",
            "Will switch to editor mode automatically",
            "Adds .md extension automatically if not specified",
            "Can add tags and description in the editor"
          ],
          related: ["edit", "template"]
        },
        {
          name: "edit",
          syntax: ["edit <filename>"],
          description: "Edit an existing note or create it if it doesn't exist",
          examples: [
            {
              command: "$ edit todo.md",
              output: "Loaded note: todo.md"
            }
          ],
          tips: [
            "Tab completion works to find existing files",
            "Will create a new file if it doesn't exist",
            "Save with Ctrl+S or the Save button"
          ],
          related: ["new", "open"]
        },
        {
          name: "open",
          syntax: ["open <filename>"],
          description: "View an existing note in read-only mode",
          examples: [
            {
              command: "$ open todo.md",
              output: "--- todo.md ---\n\nBuy groceries\nFinish project\nCall mom\n\nTags: todo, personal\nDescription: My todo list"
            }
          ],
          tips: [
            "Displays note content right in the terminal",
            "Shows tags and description at the bottom",
            "Use edit to modify the content"
          ],
          related: ["edit", "new"]
        }
      ]
    },
    {
      title: "Templates",
      commands: [
        {
          name: "template",
          syntax: [
            "template",
            "template save <name> [description]",
            "template delete <name>"
          ],
          description: "Manage note templates for quickly creating structured notes",
          examples: [
            {
              command: "$ template",
              output: "Available templates:\nmeeting - Template for meeting notes (built-in)\njournal - Daily journal template (built-in)\nproject - Custom project template (custom)"
            },
            {
              command: "$ template save project \"My project template\"",
              output: "Template saved: project"
            },
            {
              command: "$ template delete project",
              output: "Template deleted: project"
            }
          ],
          tips: [
            "Use templates with the 'new' command: new file.md --template=meeting",
            "Built-in templates cannot be modified or deleted",
            "Templates include content, tags, and description",
            "You must be in editor mode to save the current note as a template"
          ],
          related: ["new"]
        }
      ]
    },
    {
      title: "Aliases",
      commands: [
        {
          name: "alias",
          syntax: [
            "alias",
            "alias <name> <definition>",
            "alias rm <name>"
          ],
          description: "Create shortcuts for frequently used commands",
          examples: [
            {
              command: "$ alias",
              output: "Defined aliases:\nproj => cd /projects\nnotes => cd /notes; ls"
            },
            {
              command: "$ alias proj \"cd /projects\"",
              output: "Alias created: proj => cd /projects"
            },
            {
              command: "$ alias rm proj",
              output: "Removed alias: proj"
            },
            {
              command: "$ alias notes \"cd /notes; ls\"",
              output: "Alias created: notes => cd /notes; ls"
            },
            {
              command: "$ notes",
              output: "Alias expanded: cd /notes; ls\nChanged directory to /notes\n📁 projects/\n📄 welcome.md"
            }
          ],
          tips: [
            "Chain multiple commands using semicolons (;)",
            "Aliases persist between sessions",
            "Use quotes around multi-word definitions",
            "Arguments after the alias are added to the expanded command"
          ]
        }
      ]
    },
    {
      title: "Utilities",
      commands: [
        {
          name: "search",
          syntax: [
            "search <term>",
            "search <term> --tag=<tag>",
            "search <term> --path=<path>"
          ],
          description: "Search for notes containing specific text or tags",
          examples: [
            {
              command: "$ search project",
              output: "Searching for \"project\"...\n\nFound 2 matching notes:\n\n/projects/ideas.md\n...need to start a new project with...\nTags: ideas, projects\n\n/todo.md\n...Finish project by Friday...\nTags: todo, work"
            },
            {
              command: "$ search meeting --tag=work",
              output: "Searching for \"meeting\" with tag \"work\"...\n\nFound 1 matching note:\n\n/meetings/weekly.md\n...team meeting on Thursday...\nTags: meetings, work, team"
            }
          ],
          tips: [
            "Search is case-insensitive",
            "Filter by tag using --tag=tagname",
            "Limit search to specific directory with --path=/path",
            "Results show preview of matching content",
            "Both content and filenames are searched"
          ]
        },
        {
          name: "clear",
          syntax: ["clear"],
          description: "Clear the terminal history",
          examples: [
            {
              command: "$ clear",
              output: "Terminal cleared"
            }
          ],
          tips: [
            "Useful for refreshing the display",
            "Only clears visual history, not command history",
            "Command history still accessible with arrow keys"
          ]
        }
      ]
    }
  ];

  return (
    <div className={`terminal-help-guide border-r-2 border-black transition-all duration-300 ${isExpanded ? 'w-96' : 'w-10'}`}>
      <div 
        className="toggle-button flex items-center justify-center h-10 bg-[#ff6b6b] border-b-2 border-black cursor-pointer"
        onClick={toggleGuide}
      >
        {isExpanded ? (
          <>
            <ChevronRight className="h-5 w-5 text-white" />
            <span className="ml-2 font-monument text-white">Help Guide</span>
          </>
        ) : (
          <HelpCircle className="h-5 w-5 text-white" />
        )}
      </div>

      {isExpanded && (
        <ScrollArea className="h-[calc(70vh-2.5rem)] border-black">
          <div className="p-4">
            <h3 className="text-lg font-monument mb-4">Terminal Commands</h3>
            
            {commandSections.map((section) => (
              <div key={section.title} className="mb-4">
                <div 
                  className="flex items-center cursor-pointer border-2 border-black p-2 bg-[#fcd7d7] font-medium"
                  onClick={() => toggleSection(section.title)}
                >
                  {expandedSections[section.title] ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  <span>{section.title}</span>
                </div>
                
                {expandedSections[section.title] && (
                  <div className="border-2 border-t-0 border-black p-3 bg-white">
                    {section.commands.map((command) => (
                      <div key={command.name} className="mb-6">
                        <h4 className="font-bold text-[#ff6b6b]">{command.name}</h4>
                        <p className="text-sm mb-2">{command.description}</p>
                        
                        <div className="mb-2">
                          <h5 className="text-xs font-bold uppercase">Syntax:</h5>
                          <pre className="text-xs bg-gray-100 p-1 font-mono">
                            {command.syntax.join('\n')}
                          </pre>
                        </div>
                        
                        <div className="mb-2">
                          <h5 className="text-xs font-bold uppercase">Examples:</h5>
                          {command.examples.map((example, i) => (
                            <div key={i} className="mb-2">
                              <pre className="text-xs bg-gray-100 p-1 font-mono text-[#ff6b6b]">
                                {example.command}
                              </pre>
                              <pre className="text-xs bg-gray-100 p-1 font-mono">
                                {example.output}
                              </pre>
                            </div>
                          ))}
                        </div>
                        
                        {command.tips.length > 0 && (
                          <div className="mb-2">
                            <h5 className="text-xs font-bold uppercase">Tips:</h5>
                            <ul className="list-disc list-inside text-xs">
                              {command.tips.map((tip, i) => (
                                <li key={i}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {command.related && command.related.length > 0 && (
                          <div>
                            <h5 className="text-xs font-bold uppercase">Related:</h5>
                            <p className="text-xs">{command.related.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};