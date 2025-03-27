// src/components/todo/TodoWindowWrapper.tsx
'use client';

import React from 'react';
import { TodoList } from './TodoList';

// This wrapper ensures the todo list adapts well to the windowed environment
const TodoWindowWrapper: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col">
      <TodoList />
    </div>
  );
};

export default TodoWindowWrapper;