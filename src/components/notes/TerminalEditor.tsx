import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X, FileText } from 'lucide-react';

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
  
  // Template creation state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

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

  const handleSaveAsTemplate = async () => {
    try {
      // Import template service
      const { saveTemplate } = await import('../../services/templateService');
      
      // Create template object
      const template = {
        name: templateName,
        content: content,
        tags: tagsInput.split(',').map(tag => tag.trim()).filter(Boolean),
        description: templateDescription || description
      };
      
      // Save the template
      const success = saveTemplate(templateName, template);
      
      if (success) {
        // Show success message
        alert(`Template saved: ${templateName}`);
        setShowTemplateForm(false);
      } else {
        alert(`Failed to save template: ${templateName}`);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert(`Error saving template: ${error instanceof Error ? error.message : String(error)}`);
    }
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
            onClick={() => setShowTemplateForm(true)}
            variant="neutral"
            className="flex items-center"
          >
            <FileText className="mr-2 h-4 w-4" />
            Save as Template
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

      {/* Template creation form */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border-2 border-black">
            <h3 className="text-lg font-bold mb-4">Save as Template</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Template Name</label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="my-template-name"
                  className="border-2 border-black"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Template Description</label>
                <Input
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder={description || "Brief description of this template"}
                  className="border-2 border-black"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="neutral" onClick={() => setShowTemplateForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAsTemplate}>
                Save Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};