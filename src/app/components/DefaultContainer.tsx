import React from 'react'

interface DefaultContainerProps {
  children: React.ReactNode
}

export default function DefaultContainer({ children }: DefaultContainerProps) {
  return <div className="max-w-[1000px] mx-auto pt-0">{children}</div>
}

