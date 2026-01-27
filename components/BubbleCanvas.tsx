import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Task, Board } from '../types';
import { MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE, CENTER_RADIUS, calculateFontSize, POP_THRESHOLD_MS } from '../constants';
import { Maximize, Trash2, Trash } from 'lucide-react';
import { audioService } from '../services/audioService';
import { BubbleControls } from './BubbleControls';

interface BubbleCanvasProps {
  tasks: Task[];
  activeTask: Task | null;
  boards: Board[];
  onEditTask: (task: Task) => void;
  onAddTask: () => void;
  onToggleComplete: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  selectedTaskId: string | null;
  showCompleted: boolean;
  showEyeButton: boolean;
  onToggleShowCompleted: () => void;
  isShowingCompleted: boolean;
  theme?: 'dark' | 'light';
}

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  r: number;
  originalTask: Task;
  isCenter?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

const PHYSICS = {
    centerX: 0.05, 
    centerY: 0.05,
    collisionStrength: 1, 
    vDecay: 0.4, 
};

// The maximum you can zoom in (e.g., 4x magnification)
const MAX_ZOOM_IN = 4;
// A hard floor for the zoom behavior to allow "elastic" zooming out beyond the fit
const MIN_ZOOM_HARD_LIMIT = 0.02;
// Padding around the bubbles when calculating the "Perfect Fit"
const VIEWPORT_PADDING = 60;

// Unified FAB Styling
const FAB_CLASS = "p-3 rounded-2xl transition-all shadow-lg active:scale-95 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 text-slate-700 dark:text-white/80 hover:bg-white/60 dark:hover:bg-slate-900/60 hover:scale-105 hover:text-slate-900 dark:hover:text-white";

export const BubbleCanvas: React.FC<BubbleCanvasProps> = ({
  tasks,
  activeTask,
  boards,
  onEditTask,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  selectedTaskId,
  showCompleted,
  showEyeButton,
  onToggleShowCompleted: onToggleShowCompleted,
  isShowingCompleted,
  theme = 'dark',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trashBtnRef = useRef<HTMLButtonElement>(null);

  const simulationRef = useRef<d3.Simulation<SimulationNode, undefined> | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  // Interaction State
  const activePointers = useRef<Set<number>>(new Set());
  const draggingNodeRef = useRef<SimulationNode | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef<{x: number, y: number} | null>(null);
  const didPopRef = useRef(false);
  
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poppingNodeIdRef = useRef<string | null>(null);

  const [editStartPos, setEditStartPos] = useState<{x: number, y: number, k: number} | null>(null);

  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const isUserInteracting = useRef(false);
  const zoomEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoScaling = useRef(true); // Default to Auto Scaling ON
  const prevTaskCount = useRef(tasks.length);
  const prevTasksHash = useRef('');
  const lastFitKRef = useRef(0);
  
  // Stores the calculated "floor" zoom level
  const minZoomRef = useRef(0.1);
  // Zoom State for Tooltip
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const isZoomedInRef = useRef(false);
  
  // Drag to Trash State
  const [isHoveringTrash, setIsHoveringTrash] = useState(false);

  const hasResumedAudio = useRef(false);
  const ensureAudio = () => {
    if (!hasResumedAudio.current) {
      audioService.resume();
      hasResumedAudio.current = true;
    }
  };

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    if (poppingNodeIdRef.current) {
      const nodeEl = d3.select(`#node-${poppingNodeIdRef.current}`);
      if (!nodeEl.empty()) {
        const d = nodeEl.datum() as SimulationNode;
        nodeEl.select('.pop-ring').interrupt().transition().duration(300).attr('stroke-dashoffset', 2 * Math.PI * (d.r + 3));
        nodeEl.select('.shake-group').classed('charging-shake', false);
        
        const innerEl = nodeEl.select('.inner-scale');
        if (!innerEl.classed('is-popping')) {
          innerEl.interrupt().transition().duration(400).ease(d3.easeElasticOut).attr('transform', 'scale(1)');
        }
      }
      poppingNodeIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- AUTO-SCALE TRIGGER ON NEW TASK ---
  useEffect(() => {
      if (tasks.length > prevTaskCount.current) {
          // New task added: Re-enable auto scaling to fit the new bubble
          isAutoScaling.current = true;
      }
      prevTaskCount.current = tasks.length;
  }, [tasks.length]);

  // --- ZOOM INITIALIZATION ---
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('.canvas-content');

    zoomBehavior.current = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM_HARD_LIMIT, MAX_ZOOM_IN]) 
      .filter((event) => {
         if (event.type === 'touchstart' && event.touches.length > 1) return true; 
         if (event.type === 'wheel') return true;
         // Allow panning on background, disable on nodes to prioritize drag
         const isNode = event.target && (event.target as Element).closest('.node');
         if (isNode) return false;
         return true; 
      })
      .on('start', (event) => {
         if (event.sourceEvent) {
             if (zoomEndTimeoutRef.current) {
                 clearTimeout(zoomEndTimeoutRef.current);
                 zoomEndTimeoutRef.current = null;
             }
             isUserInteracting.current = true;
             isAutoScaling.current = false; // User intervention breaks auto-scale
         }
      })
      .on('end', (event) => {
         if (event.sourceEvent) {
             // Debounce the end event to prevent flicker on rapid events (e.g. wheel)
             zoomEndTimeoutRef.current = setTimeout(() => {
                 isUserInteracting.current = false;
                 zoomEndTimeoutRef.current = null;
             }, 150);
         }
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        
        // Update Zoom State for Tooltip (Throttled via check)
        const k = event.transform.k;
        const isZoomed = k > minZoomRef.current * 1.1; // 10% threshold above fit
        if (isZoomed !== isZoomedInRef.current) {
             isZoomedInRef.current = isZoomed;
             setIsZoomedIn(isZoomed);
        }
      });

    svg.call(zoomBehavior.current).on('dblclick.zoom', null);
  }, []);

  // --- INTERACTION HANDLERS ---
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
      ensureAudio();
      activePointers.current.add(event.pointerId);

      // Multi-touch logic (cancel node drag if second finger touches)
      if (activePointers.current.size > 1) {
          if (draggingNodeRef.current) {
              const d = draggingNodeRef.current;
              d.fx = null; 
              d.fy = null;
              draggingNodeRef.current = null;
              isDraggingRef.current = false;
              setIsHoveringTrash(false);
              clearHoldTimer();
              if (simulationRef.current) simulationRef.current.alphaTarget(0);
          }
          return; 
      }

      // Find Node
      const transform = d3.zoomTransform(svgRef.current!);
      const mouseX = (event.nativeEvent.offsetX - transform.x) / transform.k;
      const mouseY = (event.nativeEvent.offsetY - transform.y) / transform.k;

      let foundNode: SimulationNode | undefined;
      if (simulationRef.current) {
          foundNode = simulationRef.current.find(mouseX, mouseY, MAX_BUBBLE_SIZE);
          if (foundNode) {
              const dx = mouseX - (foundNode.x || 0);
              const dy = mouseY - (foundNode.y || 0);
              if (dx*dx + dy*dy > foundNode.r * foundNode.r) {
                  foundNode = undefined;
              }
          }
      }

      if (foundNode) {
          event.stopPropagation();
          (event.target as Element).setPointerCapture(event.pointerId);
          
          if (selectedTaskId && foundNode.id === selectedTaskId) return;

          draggingNodeRef.current = foundNode;
          dragStartPosRef.current = { x: event.clientX, y: event.clientY };
          isDraggingRef.current = false;
          didPopRef.current = false;

          // Lock position for drag
          if (!foundNode.isCenter) {
              foundNode.fx = foundNode.x;
              foundNode.fy = foundNode.y;
          }

          if (simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();

          // Pop Logic
          if (!foundNode.isCenter && foundNode.id !== selectedTaskId) {
             poppingNodeIdRef.current = foundNode.id;
             const nodeEl = d3.select(`#node-${foundNode.id}`);
             const innerEl = nodeEl.select('.inner-scale');
             const shakeEl = nodeEl.select('.shake-group');
             const popRing = nodeEl.select('.pop-ring');
             
             innerEl.transition().duration(250).ease(d3.easeCubicOut).attr('transform', 'scale(0.95)');
             shakeEl.classed('charging-shake', true);
             popRing.style('opacity', 1).transition().duration(POP_THRESHOLD_MS).ease(d3.easeQuadIn).attr('stroke-dashoffset', 0);

             holdTimerRef.current = setTimeout(() => {
                 didPopRef.current = true;
                 audioService.playPop();
                 createExplosion(foundNode?.x || 0, foundNode?.y || 0, foundNode?.originalTask.color || '#fff', foundNode?.r || 50);
                 
                 shakeEl.classed('charging-shake', false);
                 innerEl.classed('is-popping', true);
                 
                 innerEl.transition().duration(100).ease(d3.easeBackIn.overshoot(3)).attr('transform', 'scale(1.2)')
                    .style('opacity', 0)
                    .on('end', () => {
                         if (foundNode) onToggleComplete(foundNode.originalTask);
                         innerEl.classed('is-popping', false);
                         poppingNodeIdRef.current = null;
                         draggingNodeRef.current = null; 
                    });
             }, POP_THRESHOLD_MS);
          }
      }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingNodeRef.current && activePointers.current.size === 1) {
          if (dragStartPosRef.current) {
              const dx = event.clientX - dragStartPosRef.current.x;
              const dy = event.clientY - dragStartPosRef.current.y;
              if (Math.hypot(dx, dy) > 10) {
                  isDraggingRef.current = true;
                  clearHoldTimer();
              }
          }

          if (draggingNodeRef.current.isCenter) return;

          // Collision Detection with Trash
          if (trashBtnRef.current && showEyeButton) {
              const trashRect = trashBtnRef.current.getBoundingClientRect();
              const mx = event.clientX;
              const my = event.clientY;
              const buffer = 20; // Hitbox padding

              const isOver = (
                  mx >= trashRect.left - buffer && 
                  mx <= trashRect.right + buffer && 
                  my >= trashRect.top - buffer && 
                  my <= trashRect.bottom + buffer
              );

              if (isOver !== isHoveringTrash) {
                  setIsHoveringTrash(isOver);
                  if (isOver) {
                       // Haptic feedback or audio tick could go here
                       audioService.playHover();
                  }
              }
              
              // Apply shake to dragged node if hovering trash
              const nodeEl = d3.select(`#node-${draggingNodeRef.current.id} .shake-group`);
              nodeEl.classed('charging-shake', isOver);
          }

          event.preventDefault(); 
          event.stopPropagation();

          const transform = d3.zoomTransform(svgRef.current!);
          const x = (event.nativeEvent.offsetX - transform.x) / transform.k;
          const y = (event.nativeEvent.offsetY - transform.y) / transform.k;
          
          draggingNodeRef.current.fx = x;
          draggingNodeRef.current.fy = y;
          
          if (simulationRef.current) simulationRef.current.restart();
      }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
      activePointers.current.delete(event.pointerId);
      
      if (draggingNodeRef.current) {
          const d = draggingNodeRef.current;
          
          // --- DROP TO TRASH LOGIC ---
          if (isHoveringTrash && showEyeButton) {
              handleProgrammaticPop(d.originalTask);
              setIsHoveringTrash(false);
              draggingNodeRef.current = null;
              isDraggingRef.current = false;
              d.fx = null; d.fy = null;
              try { (event.target as Element).releasePointerCapture(event.pointerId); } catch(e) {}
              return;
          }

          if (!isDraggingRef.current && !didPopRef.current && activePointers.current.size === 0) {
              if (d.isCenter) {
                  if (!selectedTaskId) onAddTask();
              } else if (d.id !== selectedTaskId) {
                  // Capture screen position for "fly out" animation start point
                  if (d.x !== undefined && d.y !== undefined) {
                      const t = d3.zoomTransform(svgRef.current!);
                      const screenX = t.x + d.x * t.k;
                      const screenY = t.y + d.y * t.k;
                      setEditStartPos({ x: screenX, y: screenY, k: t.k });
                  }
                  onEditTask(d.originalTask);
              }
          }

          if (!d.isCenter && d.id !== selectedTaskId) {
              d.fx = null;
              d.fy = null;
          }
          draggingNodeRef.current = null;
          isDraggingRef.current = false;
          setIsHoveringTrash(false);
          clearHoldTimer();
          
          if (simulationRef.current) {
              simulationRef.current.alphaTarget(0); 
              simulationRef.current.alpha(0.8).restart();
          }
          
          try {
             (event.target as Element).releasePointerCapture(event.pointerId);
          } catch(e) {}
      }
  };


  useEffect(() => {
    if (!svgRef.current || !zoomBehavior.current) return;
    const svg = d3.select(svgRef.current);

    if (selectedTaskId) {
       // Disable zoom when a task is open
       svg.on('.zoom', null);
       // Reset to identity for overlay positioning stability
       svg.transition().duration(800)
          .call(zoomBehavior.current.transform, d3.zoomIdentity);
    } else {
       svg.call(zoomBehavior.current);
       setEditStartPos(null);
    }
  }, [selectedTaskId]);

  const createExplosion = (x: number, y: number, color: string, radius: number) => {
      if (!svgRef.current) return;
      const group = d3.select(svgRef.current).select('.canvas-content');
      const particleColor = color || '#ffffff';
      
      group.append('circle')
          .attr('cx', x).attr('cy', y).attr('r', radius)
          .attr('fill', 'none').attr('stroke', theme === 'dark' ? 'white' : '#64748b').attr('stroke-width', 3)
          .style('opacity', 0.6)
          .transition().duration(500).ease(d3.easeExpOut)
          .attr('r', radius * 2).style('opacity', 0).attr('stroke-width', 0).remove();
      
      const particleCount = 16;
      d3.range(particleCount).forEach(() => {
          const angle = Math.random() * Math.PI * 2;
          const speed = radius * (0.8 + Math.random() * 0.8);
          group.append('circle')
             .attr('cx', x).attr('cy', y).attr('r', 2 + Math.random() * 4).attr('fill', particleColor)
             .style('opacity', 1)
             .transition().delay(Math.random() * 50).duration(600).ease(d3.easeExpOut)
             .attr('cx', x + Math.cos(angle) * speed).attr('cy', y + Math.sin(angle) * speed).attr('r', 0).remove();
      });
         
      group.append('circle')
        .attr('cx', x).attr('cy', y).attr('r', radius * 0.8).attr('fill', 'white')
        .style('opacity', 0.4)
        .transition().duration(200).ease(d3.easeQuadOut)
        .attr('r', radius * 1.4).style('opacity', 0).remove();
  };

  const handleProgrammaticPop = (task: Task, coords?: { x: number, y: number }) => {
      const nodeEl = d3.select(`#node-${task.id}`);
      if (nodeEl.empty()) return;

      const innerEl = nodeEl.select('.inner-scale');
      const popRing = nodeEl.select('.pop-ring');
      
      let x = 0, y = 0;
      if (coords) {
          x = coords.x; y = coords.y;
      } else {
          // Fallback parsing (rarely used if coords provided)
          const transform = nodeEl.attr('transform');
          if (transform) {
              const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
              if (match) { x = parseFloat(match[1]); y = parseFloat(match[2]); }
          }
      }
      
      audioService.playPop();
      createExplosion(x, y, task.color, task.size);
      
      if (coords) {
          // Came from overlay
          setTimeout(() => {
             onToggleComplete(task);
             onEditTask(null as any);
          }, 150);
      } else {
          popRing.style('opacity', 1).transition().duration(200).attr('stroke-dashoffset', 0);
          innerEl.transition().duration(150).ease(d3.easeBackIn.overshoot(2))
            .attr('transform', 'scale(1.2)').style('opacity', 0)
            .on('end', () => {
                 onToggleComplete(task);
                 onEditTask(null as any);
            });
      }
  };

  const getOffScreenPos = (w: number, h: number) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.max(w, h); 
      return { x: w / 2 + Math.cos(angle) * dist, y: h / 2 + Math.sin(angle) * dist };
  };

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;

    const width = dimensions.width;
    const height = dimensions.height;
    
    const visibleTasks = showCompleted ? tasks : tasks.filter(t => !t.completed);
    
    // Check if we are doing a full restart (Data Change) or soft restart (Resize)
    const currentTasksHash = visibleTasks.map(t => t.id + t.completed + (t.x || 0)).join('|');
    const isDataChange = currentTasksHash !== prevTasksHash.current;
    // We only update hash if data changed significantly, ignoring minor float pos changes
    // But for initial load, tracking ID length is enough.
    // Let's stick to checking ID+Completed state
    const simpleHash = visibleTasks.map(t => t.id + t.completed).join('|');
    const isRealDataChange = simpleHash !== prevTasksHash.current;
    prevTasksHash.current = simpleHash;

    const oldNodes: SimulationNode[] = simulationRef.current?.nodes() || [];
    const oldNodesMap = new Map(oldNodes.map(n => [n.id, n]));

    const nodes: SimulationNode[] = visibleTasks.map((task) => {
      const existing = oldNodesMap.get(task.id);
      let startX, startY;
      if (existing) {
          startX = existing.x; startY = existing.y;
      } else {
          const spawn = getOffScreenPos(width, height);
          startX = spawn.x; startY = spawn.y;
      }
      return {
        id: task.id, r: task.size, originalTask: task,
        x: startX, y: startY,
        vx: existing ? existing.vx : 0, vy: existing ? existing.vy : 0,
      };
    });

    const centerNode: SimulationNode = {
      id: 'CENTER_BTN', r: CENTER_RADIUS, originalTask: {} as Task, 
      isCenter: true, fx: width / 2, fy: height / 2, x: width/2, y: height/2
    };
    if(!nodes.find(n => n.id === 'CENTER_BTN')) nodes.push(centerNode);

    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation<SimulationNode>(nodes)
        .alphaMin(0.0001).alphaDecay(0.02); 
    } else {
      simulationRef.current.nodes(nodes);
      // Gentle restart on resize, stronger on data change
      simulationRef.current.alpha(isRealDataChange ? 0.8 : 0.3).restart();
    }
    const simulation = simulationRef.current;
    const svg = d3.select(svgRef.current);
    
    // Gradient definitions (retained for brevity, same as previous)
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) defs = svg.append('defs');
    
    // --- GRADIENT SETUP (Glass/Theme) ---
    // Clears old gradients to prevent duplication/stale themes
    defs.select('#center-glass-gradient').remove();
    defs.select('#center-glass-gradient-hover').remove();
    defs.select('#center-glass-stroke').remove();
    
    const centerGrad = defs.append('linearGradient').attr('id', 'center-glass-gradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    if (theme === 'dark') {
        centerGrad.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.12);
        centerGrad.append('stop').attr('offset', '100%').attr('stop-color', 'white').attr('stop-opacity', 0.06);
    } else {
        centerGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.9);
        centerGrad.append('stop').attr('offset', '100%').attr('stop-color', '#e2e8f0').attr('stop-opacity', 0.6);
    }

    const hoverGrad = defs.append('linearGradient').attr('id', 'center-glass-gradient-hover').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    if (theme === 'dark') {
        hoverGrad.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.25);
        hoverGrad.append('stop').attr('offset', '100%').attr('stop-color', 'white').attr('stop-opacity', 0.12);
    } else {
        hoverGrad.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.95);
        hoverGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f1f5f9').attr('stop-opacity', 0.7);
    }
    
    const strokeGrad = defs.append('linearGradient').attr('id', 'center-glass-stroke').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    if (theme === 'dark') {
        strokeGrad.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.8);
        strokeGrad.append('stop').attr('offset', '40%').attr('stop-color', 'white').attr('stop-opacity', 0.2);
        strokeGrad.append('stop').attr('offset', '100%').attr('stop-color', 'white').attr('stop-opacity', 0.05);
    } else {
        strokeGrad.append('stop').attr('offset', '0%').attr('stop-color', '#94a3b8').attr('stop-opacity', 0.5);
        strokeGrad.append('stop').attr('offset', '100%').attr('stop-color', '#cbd5e1').attr('stop-opacity', 0.2);
    }

    Array.from(new Set(tasks.map(t => t.color).filter(Boolean))).forEach((color: string) => {
        const id = `grad-${color.replace('#', '')}`;
        if (defs.select(`#${id}`).empty()) {
            const grad = defs.append('linearGradient').attr('id', id).attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
            grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 1);
            grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(color)?.brighter(0.8)?.toString() || color).attr('stop-opacity', 1);
        }
    });

    // Node Rendering
    const svgContent = svg.select('.canvas-content');
    const nodeSelection = svgContent.selectAll<SVGGElement, SimulationNode>('.node').data(nodes, d => d.id);

    nodeSelection.exit().transition().duration(600).style('opacity', 0).attr('transform', (d: any) => `translate(${d.x},${d.y}) scale(0.1)`).remove();

    const enterGroup = nodeSelection.enter().append('g')
       .attr('class', d => `node cursor-pointer group ${d.isCenter ? 'center-node' : ''}`)
       .attr('id', d => `node-${d.id}`);
    
    const inner = enterGroup.append('g').attr('class', 'inner-scale transition-transform duration-75');
    const shaker = inner.append('g').attr('class', 'shake-group'); 

    shaker.append('circle').attr('class', 'pop-ring').attr('fill', 'none').attr('stroke', theme === 'dark' ? '#ffffff' : '#64748b').attr('stroke-width', 4).attr('opacity', 0).style('pointer-events', 'none')
        .attr('transform', 'rotate(-90)');

    shaker.append('circle')
        .attr('class', d => `main-bubble transition-colors duration-300 ${d.isCenter ? 'backdrop-blur-xl' : 'backdrop-blur-sm'}`)
        .attr('stroke-width', 0);

    shaker.append('g').attr('class', 'text-content pointer-events-none')
         .append('foreignObject').append('xhtml:div')
         .attr('class', 'w-full h-full flex flex-col items-center justify-center text-center overflow-hidden bubble-text-container')
         .html(d => `<div class="bubble-text font-bold leading-tight select-none drop-shadow-lg px-0.5" style="overflow-wrap: normal; word-break: normal; hyphens: none; white-space: pre-line; line-height: 1.1;"></div>`);

    inner.filter(d => !!d.isCenter).append('foreignObject').attr('class', 'center-btn-container pointer-events-none') 
       .append('xhtml:div').attr('class', 'w-full h-full flex items-center justify-center text-white center-icon').html('');

    const allNodes = enterGroup.merge(nodeSelection);
    allNodes.filter(d => !!d.isCenter).raise();
    
    const isMobile = dimensions.width < 768;
    allNodes.filter(d => !!d.isCenter).select('.center-btn-container')
       .attr('width', isMobile ? 80 : 48).attr('height', isMobile ? 80 : 48).attr('x', isMobile ? -40 : -24).attr('y', isMobile ? -40 : -24);
    allNodes.filter(d => !!d.isCenter).select('.center-icon')
       .style('color', theme === 'dark' ? 'white' : '#475569')
       .html(`<div style="font-family: inherit; font-weight: 200; font-size: ${isMobile ? 56 : 42}px; line-height: 1; margin-top: -4px;">+</div>`);

    allNodes.select('.main-bubble')
        .attr('r', d => d.r)
        .attr('fill', d => {
            if (d.isCenter) return 'url(#center-glass-gradient)'; 
            if (d.originalTask.completed) return theme === 'dark' ? '#1e293b' : '#cbd5e1'; 
            const color = d.originalTask.color;
            if (!color) return '#cccccc'; 
            return `url(#grad-${color.replace('#', '')})`;
        })
        .attr('stroke', d => d.isCenter ? 'url(#center-glass-stroke)' : 'none')
        .attr('stroke-width', d => d.isCenter ? null : 0) 
        .style('filter', d => d.isCenter ? (theme === 'dark' ? 'drop-shadow(0px 8px 32px rgba(0,0,0,0.25))' : 'drop-shadow(0px 8px 24px rgba(0,0,0,0.15))') : (theme === 'dark' ? 'drop-shadow(0px 10px 20px rgba(0,0,0,0.2))' : 'drop-shadow(0px 4px 16px rgba(148, 163, 184, 0.4))'))
        .attr('class', d => `main-bubble transition-colors duration-300 ${d.isCenter ? 'backdrop-blur-xl' : 'backdrop-blur-sm'}`);

    allNodes.select('.pop-ring')
        .attr('r', d => d.r + 3).attr('stroke', theme === 'dark' ? '#ffffff' : '#64748b')
        .attr('stroke-dasharray', d => 2 * Math.PI * (d.r + 3)).attr('stroke-dashoffset', d => 2 * Math.PI * (d.r + 3));

    allNodes.select('.text-content foreignObject')
        .attr('width', d => d.r * 1.38).attr('height', d => d.r * 1.38).attr('x', d => -d.r * 0.69).attr('y', d => -d.r * 0.69);

    allNodes.select('.bubble-text-container')
        .html(d => {
            if (d.isCenter) return '';
            const subtaskCount = d.originalTask.subtasks?.length || 0;
            const completedSubtasks = d.originalTask.subtasks?.filter(s => s.completed).length || 0;
            let html = `<div class="bubble-text font-bold leading-tight select-none drop-shadow-lg px-0.5" style="overflow-wrap: normal; word-break: normal; hyphens: none; white-space: pre-line; line-height: 1.1;">${d.originalTask.title}</div>`;
            
            if (d.originalTask.dueDate) {
                const date = new Date(d.originalTask.dueDate);
                const now = new Date();
                const isOverdue = date < now && !d.originalTask.completed;
                const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
                const dateStr = isToday ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const dateSize = Math.max(9, d.r * 0.18);
                const pillColor = isOverdue ? 'rgba(239, 68, 68, 0.9)' : 'rgba(0, 0, 0, 0.2)';
                html += `<div style="margin-top: 6px;"><div style="display: inline-block; background: ${pillColor}; padding: 2px 8px; border-radius: 99px; font-size: ${dateSize}px; color: white; font-weight: 600; backdrop-filter: blur(4px);">${dateStr}</div></div>`;
            }
            if (subtaskCount > 0) html += `<div style="margin-top: 4px; font-size: ${d.r * 0.2}px; opacity: 0.8; font-weight: 600;">${completedSubtasks}/${subtaskCount}</div>`;
            return html;
        });

    allNodes.select('.bubble-text')
        .style('color', d => d.originalTask.completed ? (theme === 'dark' ? '#94a3b8' : '#64748b') : '#ffffff')
        .style('font-size', d => {
            let size = calculateFontSize(d.r, d.originalTask.title);
            if (d.originalTask.dueDate || (d.originalTask.subtasks && d.originalTask.subtasks.length > 0)) size = size * 0.85;
            return `${size}px`;
        })
        .style('opacity', d => d.originalTask.completed ? 0.6 : 1)
        .style('text-decoration', d => d.originalTask.completed ? 'line-through' : 'none');

    allNodes.style('pointer-events', d => d.id === selectedTaskId ? 'none' : 'all');
    allNodes.select('.inner-scale').style('opacity', d => d.id === selectedTaskId ? 0 : 1).attr('transform', 'scale(1)');

    simulation.on('tick', () => {
       // 1. Prevent Center Overlap
       const cx = dimensions.width / 2;
       const cy = dimensions.height / 2;
       const hardCenterBuffer = 10; 
       
       nodes.forEach(node => {
          if (node.isCenter || node.id === selectedTaskId || node.x === undefined || node.y === undefined) return;
          const dx = node.x - cx;
          const dy = node.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDistance = CENTER_RADIUS + node.r + hardCenterBuffer;

          if (dist < minDistance) {
              const angle = dist === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
              node.x = cx + Math.cos(angle) * minDistance;
              node.y = cy + Math.sin(angle) * minDistance;
              if (node.vx && node.vy) { node.vx *= 0.5; node.vy *= 0.5; }
          }
       });

       // 2. Update Position
       allNodes.attr('transform', d => `translate(${d.x},${d.y})`);

       // 3. UNIFIED CAMERA LOGIC
       if (zoomBehavior.current && svgRef.current) {
           const simCx = dimensions.width / 2;
           const simCy = dimensions.height / 2;

           // Calculate Bounds (Symmetric for Fit, Actual for Extent)
           let maxDistX = 0;
           let maxDistY = 0;
           let hasNodes = false;

           nodes.forEach(n => {
              if (n.x === undefined || n.y === undefined) return;
              hasNodes = true;
              const r = n.r + 20; 
              
              // Distance from center (Symmetric calc for FitK to align with simulation center)
              const dx = Math.abs(n.x - simCx) + r;
              const dy = Math.abs(n.y - simCy) + r;

              if (dx > maxDistX) maxDistX = dx;
              if (dy > maxDistY) maxDistY = dy;
           });

           if (!hasNodes) {
               maxDistX = 100;
               maxDistY = 100;
           }

           // Determine necessary viewport size to fit this symmetric bounds
           const requiredW = (maxDistX + VIEWPORT_PADDING) * 2;
           const requiredH = (maxDistY + VIEWPORT_PADDING) * 2;

           // Calculate Fit Scale
           const scaleX = dimensions.width / requiredW;
           const scaleY = dimensions.height / requiredH;
           let fitK = Math.min(scaleX, scaleY);
           
           fitK = Math.min(fitK, MAX_ZOOM_IN);
           fitK = Math.max(fitK, MIN_ZOOM_HARD_LIMIT); 

           minZoomRef.current = fitK;

           // --- DYNAMIC CONSTRAINTS (Gated by interaction state and change threshold) ---
           if (!isUserInteracting.current && zoomBehavior.current) {
                // Only update if fitK changed significantly (e.g. layout change) to prevent flickering
                if (Math.abs(fitK - lastFitKRef.current) > 0.005) {
                    lastFitKRef.current = fitK;
                    
                    // Apply Scale Extent: Snap bottom to fitK (Hard Stop for "Max Zoom Out")
                    zoomBehavior.current.scaleExtent([fitK, MAX_ZOOM_IN]);
                    
                    // Calculate the world size visible at max zoom (fitK)
                    const worldVisibleW = dimensions.width / fitK;
                    const worldVisibleH = dimensions.height / fitK;

                    // Set translate extent exactly to the viewport world size at max zoom.
                    zoomBehavior.current.translateExtent([
                       [simCx - worldVisibleW / 2, simCy - worldVisibleH / 2],
                       [simCx + worldVisibleW / 2, simCy + worldVisibleH / 2]
                    ]);
                }
           }

           // AUTOMATIC DRIFT (Seamless "Snap-to-Fit")
           if (!isUserInteracting.current && !selectedTaskId) {
               const t = d3.zoomTransform(svg.node() as Element);

               const isAtOrBelowFloor = t.k < fitK * 1.01;

               // Requirement 1 & 2: If auto-scaling mode is active OR we are naturally at the floor
               if (isAutoScaling.current || isAtOrBelowFloor) {
                   // Target: Center Node (simCx, simCy) at Screen Center
                   // transform.x = screenCenter - simCenter * k
                   const targetX = (dimensions.width / 2) - simCx * fitK;
                   const targetY = (dimensions.height / 2) - simCy * fitK;
                   
                   const k = t.k + (fitK - t.k) * 0.1;
                   const x = t.x + (targetX - t.x) * 0.1;
                   const y = t.y + (targetY - t.y) * 0.1;

                   if (Math.abs(k - t.k) > 0.0001 || Math.hypot(x - t.x, y - t.y) > 0.1) {
                       zoomBehavior.current.transform(svg, d3.zoomIdentity.translate(x, y).scale(k));
                   }
               }
           }
       }
    });

    return () => { simulation.stop(); };
  }, [tasks, showCompleted, selectedTaskId, dimensions, clearHoldTimer, theme]);

  useEffect(() => {
     if (!simulationRef.current) return;
     const sim = simulationRef.current;
     const width = dimensions.width;
     const height = dimensions.height;

     sim.force('x', d3.forceX(width / 2).strength(selectedTaskId ? 0.005 : PHYSICS.centerX));
     sim.force('y', d3.forceY(height / 2).strength(selectedTaskId ? 0.005 : PHYSICS.centerY));
     
     sim.force('charge', d3.forceManyBody().strength((d: any) => {
        if (d.isCenter) return -600; 
        if (d.id === selectedTaskId) return -40; 
        const base = -100;
        const sizeFactor = d.r ? d.r * 0.2 : 0; 
        return base - sizeFactor;
     }));
     
     sim.force('collide', d3.forceCollide<SimulationNode>()
        .radius(d => {
            if (d.id === selectedTaskId) return MIN_BUBBLE_SIZE + 10;
            if (d.isCenter) return d.r + 25; 
            return d.r + 6; 
        }).strength(1).iterations(40));

     sim.velocityDecay(PHYSICS.vDecay);
     sim.alpha(0.8).restart();
  }, [dimensions, selectedTaskId]);

  const handleResetView = useCallback(() => {
    ensureAudio();
    isAutoScaling.current = true; // Manual reset re-enables auto-scale
    if (simulationRef.current) simulationRef.current.alpha(0.3).restart();
  }, []);

  const selectedTask = activeTask || tasks.find(t => t.id === selectedTaskId);
  
  // Logic to determine if trash is "open" (spilled or receiving)
  const isTrashOpen = isShowingCompleted || isHoveringTrash;

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-slate-50 dark:bg-[#020617] overflow-hidden transition-colors duration-500" onPointerDown={ensureAudio}>
      <style>{`
        @keyframes shake-charge {
          0% { transform: translate(0, 0); }
          25% { transform: translate(1.5px, 1.5px); }
          50% { transform: translate(-1.5px, -2px); }
          75% { transform: translate(-2px, 1.5px); }
          100% { transform: translate(1.5px, -1.5px); }
        }
        .charging-shake {
          animation: shake-charge 0.08s infinite linear;
        }
        .center-node .main-bubble {
            stroke-width: 1.2px; transition: all 0.3s ease;
        }
        .center-node:hover .main-bubble {
            fill: url(#center-glass-gradient-hover) !important;
            stroke: ${theme === 'dark' ? 'white' : '#94a3b8'} !important;
            stroke-width: 1.5px !important;
        }
        .center-node .center-icon {
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .center-node:hover .center-icon {
            transform: scale(1.1);
        }
      `}</style>
      
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
         <div className={`absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#E879F9] blur-[120px] transition-opacity duration-500 ${theme === 'dark' ? 'opacity-20' : 'opacity-40'}`} />
         <div className={`absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#22D3EE] blur-[140px] transition-opacity duration-500 ${theme === 'dark' ? 'opacity-20' : 'opacity-40'}`} />
         <div className={`absolute bottom-[-20%] right-[10%] w-[40%] h-[40%] rounded-full bg-[#818CF8] blur-[100px] transition-opacity duration-500 ${theme === 'dark' ? 'opacity-20' : 'opacity-40'}`} />
      </div>

      <svg 
        ref={svgRef} 
        className={`absolute inset-0 w-full h-full z-10 ${selectedTaskId ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none' }} 
      >
        <g className="canvas-content" />
      </svg>

      {selectedTaskId && selectedTask && (
          <>
            <div className={`absolute inset-0 z-20 animate-fade-in cursor-pointer ${theme === 'dark' ? 'bg-black/40 backdrop-blur-sm' : 'bg-slate-200/40 backdrop-blur-sm'}`} 
                onClick={() => onEditTask(null as any)} />
            <div className="absolute inset-0 z-30 pointer-events-none">
                 <BubbleControls 
                    task={selectedTask} boards={boards} startPos={editStartPos}
                    onUpdate={(t) => onEditTask(t)} onDelete={onDeleteTask} onClose={() => onEditTask(null as any)}
                    onPop={(coords) => handleProgrammaticPop(selectedTask, coords)}
                 />
            </div>
          </>
      )}

      {!selectedTaskId && (
          <>
            {showEyeButton && (
                <div className="absolute bottom-8 left-8 z-50">
                    <button 
                        ref={trashBtnRef}
                        onClick={onToggleShowCompleted} 
                        className={`${FAB_CLASS} ${isHoveringTrash ? 'bg-red-500/20 border-red-500 text-red-500 scale-125' : ''} ${isShowingCompleted ? (theme === 'dark' ? 'bg-white/10 text-white border-white/30' : 'bg-white text-slate-900 border-white/60') : ''}`}
                    >
                    <div className={`transition-transform duration-500 relative ${isShowingCompleted ? 'rotate-[135deg]' : 'rotate-0'}`}>
                         {isTrashOpen ? <Trash size={22} /> : <Trash2 size={22} />}
                         
                         {/* Debris particles - Only visible when spilled (and rotated) */}
                         {isShowingCompleted && (
                             <div className="absolute -top-3 left-0 w-full h-full flex justify-center gap-1 pointer-events-none">
                                <div className="w-1 h-1 bg-current rounded-full opacity-80" />
                                <div className="w-1.5 h-1.5 bg-current rounded-sm opacity-80 translate-y-1" />
                                <div className="w-1 h-1 bg-current rounded-full opacity-80" />
                             </div>
                         )}
                    </div>
                    </button>
                </div>
            )}
            
            <div className={`absolute bottom-8 right-8 z-50 flex flex-col items-center transition-all duration-300 ${isZoomedIn ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                {/* Reset Zoom Tooltip - To the Left */}
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800/90 dark:bg-white/90 text-white dark:text-slate-900 text-[10px] font-bold rounded-lg shadow-lg backdrop-blur-sm whitespace-nowrap pointer-events-none">
                    Reset Zoom
                </div>
                <button onClick={handleResetView} 
                  className={FAB_CLASS}
                  title="Reset View">
                    <Maximize size={22} />
                </button>
            </div>
          </>
      )}
    </div>
  );
}