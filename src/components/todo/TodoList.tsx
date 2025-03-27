import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, CheckSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export const TodoList: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');

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
      createdAt: Date.now()
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

  // Sort todos: incomplete first, then by creation date (newest first)
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div className="flex items-center justify-between bg-[#ff6b6b] text-white px-4 py-2 border-b-2 border-black">
        <h2 className="font-monument text-xl">Todo List</h2>
        {todos.some(todo => todo.completed) && (
          <Button 
            onClick={clearCompleted}
            variant="neutral"
            className="h-8 px-2 text-xs flex items-center border border-white text-white bg-transparent hover:bg-white/20"
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            Clear completed
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {sortedTodos.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No tasks yet. Add one below!</p>
        ) : (
          <ul className="space-y-2">
            {sortedTodos.map(todo => (
              <li key={todo.id} className={`flex items-center p-2 border-2 border-black rounded-lg transition-colors ${todo.completed ? 'bg-gray-50' : 'bg-white'}`}>
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