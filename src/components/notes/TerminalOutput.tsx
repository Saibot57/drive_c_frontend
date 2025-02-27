import React from 'react';

interface TerminalOutputProps {
  history: Array<{ type: 'command' | 'output'; content: string }>;
}

export const TerminalOutput: React.FC<TerminalOutputProps> = ({ history }) => {
  return (
    <div className="terminal-output">
      {history.map((entry, index) => (
        <div key={index} className="mb-2">
          {entry.type === 'command' ? (
            <div className="flex">
              <span className="text-[#ff6b6b] font-bold mr-2">$</span>
              <span>{entry.content}</span>
            </div>
          ) : (
            <div className="pl-4 text-gray-800">{entry.content}</div>
          )}
        </div>
      ))}
    </div>
  );
};