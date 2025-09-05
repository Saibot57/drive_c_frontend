import React from 'react';
import Picker from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';

interface IconPickerProps {
  onSelect: (icon: string) => void;
  onClose: () => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ onSelect, onClose }) => {
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
    onClose();
  };

  return (
    <div className="icon-picker-popover">
      <div className="icon-picker-header">
        <h4>Välj en ikon</h4>
        <button onClick={onClose} className="modal-close" style={{ width: '30px', height: '30px' }}>×</button>
      </div>
      <Picker onEmojiClick={handleEmojiClick} />
    </div>
  );
};