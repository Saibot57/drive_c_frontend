import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, CheckSquare, GripVertical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  order?: number; // Added for manual sorting
}

export const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [draggedTodo, setDraggedTodo] = useState<string | null>(null);
  const [dragOverTodo, setDragOverTodo] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('workspace-todos');
    if (saved) {
      try {
        setTodos(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading todos from localStorage:', e);
      }
    }
  }, []);

  // Save to localStorage when todos change
  useEffect(() => {
    localStorage.setItem('workspace-todos', JSON.stringify(todos));
  }, [todos]);

  // Add new todo
  const addTodo = () => {
    if (!newTodo.trim()) return;
    
    setTodos([...todos, {
      id: Date.now().toString(),
      text: newTodo.trim(),
      completed: false,
      createdAt: Date.now(),
      order: todos.length // Set initial order to list length
    }]);
    setNewTodo('');
  };

  // Toggle todo completion
  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  // Remove todo
  const removeTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  // Clear completed todos
  const clearCompleted = () => {
    setTodos(todos.filter(todo => !todo.completed));
  };

  // Handle drag start
  const handleDragStart = (id: string) => {
    setDraggedTodo(id);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedTodo) {
      setDragOverTodo(id);
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (!draggedTodo || !dragOverTodo) return;
    
    // Reorder the todos
    const updatedTodos = [...todos];
    const draggedIndex = updatedTodos.findIndex(todo => todo.id === draggedTodo);
    const dropIndex = updatedTodos.findIndex(todo => todo.id === dragOverTodo);
    
    if (draggedIndex === -1 || dropIndex === -1) return;
    
    // Remove the dragged item
    const [draggedItem] = updatedTodos.splice(draggedIndex, 1);
    
    // Insert it at the new position
    updatedTodos.splice(dropIndex, 0, draggedItem);
    
    // Update the order property for all todos
    const reorderedTodos = updatedTodos.map((todo, index) => ({
      ...todo,
      order: index
    }));
    
    setTodos(reorderedTodos);
    setDraggedTodo(null);
    setDragOverTodo(null);
  };

  // Sort todos: incomplete first, then by manual order or creation date
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    
    // If both have the same completion status, sort by order if available
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    
    // Fall back to creation date
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <ScrollArea className="flex-1 p-4">
        {todos.some(todo => todo.completed) && (
          <div className="flex justify-end mb-3">
            <Button 
              onClick={clearCompleted}
              variant="neutral"
              className="h-8 px-2 text-xs flex items-center border-2 border-black bg-white hover:bg-gray-50"
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              Clear completed
            </Button>
          </div>
        )}
      
        {sortedTodos.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No tasks yet. Add one below!</p>
        ) : (
          <ul className="space-y-2">
            {sortedTodos.map(todo => (
              <li 
                key={todo.id} 
                className={`flex items-center p-2 border-2 border-black rounded-lg transition-colors 
                  ${todo.completed ? 'bg-gray-50' : 'bg-white'}
                  ${dragOverTodo === todo.id ? 'border-dashed' : ''}
                  ${draggedTodo === todo.id ? 'opacity-50' : ''}`}
                draggable
                onDragStart={() => handleDragStart(todo.id)}
                onDragOver={(e) => handleDragOver(e, todo.id)}
                onDrop={handleDrop}
                onDragEnd={() => {
                  setDraggedTodo(null);
                  setDragOverTodo(null);
                }}
              >
                <div className="cursor-move mr-2">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
                <Checkbox 
                  checked={todo.completed} 
                  onCheckedChange={() => toggleTodo(todo.id)}
                  className="mr-2"
                />
                <span className={`flex-1 ${todo.completed ? 'line-through text-gray-500' : ''}`}>
                  {todo.text}
                </span>
                <Button 
                  variant="neutral" 
                  size="sm" 
                  onClick={() => removeTodo(todo.id)}
                  className="ml-2 h-6 w-6 p-0 bg-white hover:bg-gray-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
      
      <div className="border-t-2 border-black p-3">
        <form onSubmit={(e) => { e.preventDefault(); addTodo(); }} className="flex">
          <Input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a new task..."
            className="border-2 border-black flex-1 mr-2"
            autoComplete="off"
          />
          <Button 
            type="submit" 
            className="border-2 border-black bg-[#ff6b6b] text-white hover:bg-[#ff5252]"
          >
            Add
          </Button>
        </form>
      </div>
    </div>
  );
};