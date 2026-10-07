import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Eye, EyeOff, GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TYPES, blockName } from "@/components/cms/blockTypes";

const AddHere = ({ onClick }) => (
  <button onClick={onClick} className="group w-full h-6 flex items-center gap-2 text-foreground/25 hover:text-[#C9A24A]" aria-label="Dodaj blok tutaj">
    <span className="flex-1 h-px bg-current opacity-40" /><Plus className="h-3.5 w-3.5" /><span className="flex-1 h-px bg-current opacity-40" />
  </button>
);

// Lista bloków: przeciąganie, pokaż/ukryj, menu ⋯ i „+” między blokami.
export default function BlockList({ blocks, selectedId, onSelect, onReorder, onToggle, onAction, onAdd }) {
  const drop = (r) => { if (r.destination) onReorder(r.source.index, r.destination.index); };
  return (
    <DragDropContext onDragEnd={drop}>
      <Droppable droppableId="blocks">
        {(p) => (
          <div ref={p.innerRef} {...p.droppableProps}>
            <AddHere onClick={() => onAdd(0)} />
            {blocks.map((b, i) => {
              const t = TYPES[b.typ];
              return (
                <Draggable key={b.id} draggableId={b.id} index={i}>
                  {(d) => (
                    <div ref={d.innerRef} {...d.draggableProps}>
                      <div className={`flex items-center gap-2 border px-2 min-h-[52px] bg-[#0A0A0B] ${selectedId === b.id ? "border-[#C9A24A]" : "hairline"} ${b.widoczny === false ? "opacity-50" : ""}`}>
                        <span {...d.dragHandleProps} className="text-foreground/30 cursor-grab p-1" aria-label="Przeciągnij"><GripVertical className="h-4 w-4" /></span>
                        <button onClick={() => onSelect(b.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left py-2">
                          <t.icon className="h-4 w-4 gold-text shrink-0" />
                          <span className="min-w-0"><span className="block text-sm truncate">{blockName(b)}</span><span className="block technical text-[9px] text-foreground/40">{t.label}</span></span>
                        </button>
                        <button onClick={() => onToggle(b.id)} aria-label={b.widoczny === false ? "Pokaż" : "Ukryj"} className="p-2 text-foreground/50 hover:text-[#C9A24A]">
                          {b.widoczny === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-2 text-foreground/50 hover:text-[#C9A24A]" aria-label="Więcej"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#0F0F10] border hairline rounded-none">
                            <DropdownMenuItem onClick={() => onAction("duplikuj", i)}>Duplikuj</DropdownMenuItem>
                            <DropdownMenuItem disabled={!i} onClick={() => onAction("wyzej", i)}>Przenieś wyżej</DropdownMenuItem>
                            <DropdownMenuItem disabled={i === blocks.length - 1} onClick={() => onAction("nizej", i)}>Przenieś niżej</DropdownMenuItem>
                            <DropdownMenuItem className="text-[#BC1E22]" onClick={() => onAction("usun", i)}>Usuń</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <AddHere onClick={() => onAdd(i + 1)} />
                    </div>
                  )}
                </Draggable>
              );
            })}
            {p.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}