import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';

interface TerminalEditorProps {
  initialContent: string;
  initialMetadata: {
    tags: string[];
    description: string;
  };
  onSave: (content: string, metadata: { tags: string[]; description: string }) => void;
  onCancel: () => void;
}

export const TerminalEditor: React.FC<TerminalEditorProps> = ({
  initialContent,
  initialMetadata,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const [tagsInput, setTagsInput] = useState(initialMetadata.tags.join(', '));
  const [description, setDescription] = useState(initialMetadata.description);

  const handleSave = () => {
    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    
    onSave(content, {
      tags,
      description,
    });
  };

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 p-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full min-h-[300px] resize-none font-mono border-2 border-black focus-visible:ring-0"
          placeholder="Write your note here..."
          autoFocus
        />
      </div>
      
      <div className="border-t-2 border-black p-4 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Tags (comma separated)</label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full border-2 border-black"
            placeholder="productivity, ideas, todo"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border-2 border-black"
            placeholder="Brief description of this note"
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button 
            onClick={onCancel}
            variant="neutral"
            className="flex items-center"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="flex items-center"
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};