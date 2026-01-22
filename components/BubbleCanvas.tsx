import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Task, Board } from '../types';
import { MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE, CENTER_RADIUS, calculateFontSize, POP_THRESHOLD_MS } from '../constants';
import { Maximize, Eye, EyeOff } from 'lucide-react';
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

// Config limits
const MAX_ZOOM_LEVEL = 3;
const MIN_ZOOM_LEVEL = 0.1;
const AUTO_SCALE_MAX = 1; 

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
  onToggleShowCompleted,
  isShowingCompleted,
  theme = 'dark',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
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
  
  const [isAutoScaling, setIsAutoScaling] = useState(true);
  const isAutoScalingRef = useRef(true); 

  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const prevTasksLengthRef = useRef(tasks.length);
  
  const fitStateRef = useRef({ k: 1, x: 0, y: 0 });

  const hasResumedAudio = useRef(false);
  const ensureAudio = () => {
    if (!hasResumedAudio.current) {
      audioService.resume();
      hasResumedAudio.current = true;
    }
  };

  useEffect(() => {
    isAutoScalingRef.current = isAutoScaling;
  }, [isAutoScaling]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    if (poppingNodeIdRef.current) {
      const nodeEl = d3.select(`#node-${poppingNodeIdRef.current}`);
      if (!nodeEl.empty()) {
        const d = nodeEl.datum() as SimulationNode;
        // Reset visuals
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

  useEffect(() => {
    if (tasks.length > prevTasksLengthRef.current) {
      setIsAutoScaling(true);
    }
    prevTasksLengthRef.current = tasks.length;
  }, [tasks.length]);

  // --- ZOOM CONFIGURATION ---
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('.canvas-content');

    zoomBehavior.current = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL])
      .filter((event) => {
         if (event.type === 'touchstart' && event.touches.length > 1) return true; 
         if (event.type === 'wheel') return true;
         const isNode = event.target && (event.target as Element).closest('.node');
         if (isNode) return false;
         return true; 
      })
      .on('start', (event) => {
         if (event.sourceEvent) isUserInteracting.current = true;
      })
      .on('end', (event) => {
         if (event.sourceEvent) isUserInteracting.current = false;
      })
      .on('zoom', (event) => {
        if (!event.sourceEvent) {
            g.attr('transform', event.transform);
            transformRef.current = event.transform;
            return;
        }

        const newTransform = event.transform;
        const fitK = fitStateRef.current.k;

        if (isAutoScalingRef.current) {
             if (newTransform.k > fitK * 1.05) {
                 setIsAutoScaling(false);
                 isAutoScalingRef.current = false;
             } 
             g.attr('transform', newTransform);
             transformRef.current = newTransform;
        } else {
            if (newTransform.k <= fitK * 1.02) {
                setIsAutoScaling(true);
                isAutoScalingRef.current = true;
                g.attr('transform', newTransform);
                transformRef.current = newTransform;
            } else {
                g.attr('transform', newTransform);
                transformRef.current = newTransform;
            }
        }
      });

    svg.call(zoomBehavior.current).on('dblclick.zoom', null);
  }, []);

  // --- MANUAL POINTER INTERACTION ---
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
      ensureAudio();
      activePointers.current.add(event.pointerId);

      if (activePointers.current.size > 1) {
          if (draggingNodeRef.current) {
              const d = draggingNodeRef.current;
              d.fx = null; 
              d.fy = null;
              draggingNodeRef.current = null;
              isDraggingRef.current = false;
              clearHoldTimer();
              if (simulationRef.current) simulationRef.current.alphaTarget(0);
          }
          return; 
      }

      const t = transformRef.current;
      const mouseX = (event.nativeEvent.offsetX - t.x) / t.k;
      const mouseY = (event.nativeEvent.offsetY - t.y) / t.k;

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

          if (!foundNode.isCenter) {
              foundNode.fx = foundNode.x;
              foundNode.fy = foundNode.y;
          }

          if (simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();

          if (!foundNode.isCenter && foundNode.id !== selectedTaskId) {
             poppingNodeIdRef.current = foundNode.id;
             const nodeEl = d3.select(`#node-${foundNode.id}`);
             const innerEl = nodeEl.select('.inner-scale');
             const shakeEl = nodeEl.select('.shake-group');
             const popRing = nodeEl.select('.pop-ring');
             
             // HOLD ANIMATION START
             innerEl.transition().duration(250).ease(d3.easeCubicOut).attr('transform', 'scale(0.95)');
             shakeEl.classed('charging-shake', true);
             
             // Progress ring - easeQuadIn creates "building pressure" feel
             popRing.style('opacity', 1).transition().duration(POP_THRESHOLD_MS).ease(d3.easeQuadIn).attr('stroke-dashoffset', 0);

             holdTimerRef.current = setTimeout(() => {
                 didPopRef.current = true;
                 
                 audioService.playPop();
                 createExplosion(foundNode?.x || 0, foundNode?.y || 0, foundNode?.originalTask.color || '#fff', foundNode?.r || 50);
                 
                 shakeEl.classed('charging-shake', false);
                 innerEl.classed('is-popping', true);
                 
                 // Implode slightly then burst
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

          event.preventDefault(); 
          event.stopPropagation();

          const t = transformRef.current;
          const x = (event.nativeEvent.offsetX - t.x) / t.k;
          const y = (event.nativeEvent.offsetY - t.y) / t.k;
          
          draggingNodeRef.current.fx = x;
          draggingNodeRef.current.fy = y;
          
          if (simulationRef.current) simulationRef.current.restart();
      }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
      activePointers.current.delete(event.pointerId);
      
      if (draggingNodeRef.current) {
          const d = draggingNodeRef.current;
          
          if (!isDraggingRef.current && !didPopRef.current && activePointers.current.size === 0) {
              if (d.isCenter) {
                  onAddTask();
              } else if (d.id !== selectedTaskId) {
                  if (d.x !== undefined && d.y !== undefined) {
                      const t = transformRef.current;
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
       svg.on('.zoom', null);
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
      
      // 1. Shockwave Ripple
      group.append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', radius)
          .attr('fill', 'none')
          .attr('stroke', theme === 'dark' ? 'white' : '#64748b')
          .attr('stroke-width', 3)
          .style('opacity', 0.6)
          .transition().duration(500).ease(d3.easeExpOut)
          .attr('r', radius * 2)
          .style('opacity', 0)
          .attr('stroke-width', 0)
          .remove();
      
      // 2. Sparkles/Debris
      const particleCount = 16;
      const particles = d3.range(particleCount).map(() => ({
          angle: Math.random() * Math.PI * 2,
          // Distribute speeds for depth
          speed: radius * (0.8 + Math.random() * 0.8), 
          size: 2 + Math.random() * 4,
          delay: Math.random() * 50
      }));

      group.selectAll(`.particle-${Date.now()}`)
         .data(particles)
         .enter()
         .append('circle')
         .attr('cx', x)
         .attr('cy', y)
         .attr('r', d => d.size)
         .attr('fill', particleColor)
         .style('opacity', 1)
         .transition()
         .delay(d => d.delay)
         .duration(600)
         .ease(d3.easeExpOut)
         .attr('cx', d => x + Math.cos(d.angle) * d.speed)
         .attr('cy', d => y + Math.sin(d.angle) * d.speed)
         .attr('r', 0)
         .remove();
         
      // 3. Central Flash
      group.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', radius * 0.8)
        .attr('fill', 'white')
        .style('opacity', 0.4)
        .transition().duration(200).ease(d3.easeQuadOut)
        .attr('r', radius * 1.4)
        .style('opacity', 0)
        .remove();
  };

  const handleProgrammaticPop = (task: Task, coords?: { x: number, y: number }) => {
      const nodeEl = d3.select(`#node-${task.id}`);
      if (nodeEl.empty()) return;

      const innerEl = nodeEl.select('.inner-scale');
      const popRing = nodeEl.select('.pop-ring');
      
      const transform = nodeEl.attr('transform');
      let x = 0, y = 0;
      if (transform) {
          const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
          if (match) { x = parseFloat(match[1]); y = parseFloat(match[2]); }
      }
      
      // Override position if provided (from Overlay)
      if (coords) {
          // Since the canvas is likely zoomed to Identity (0,0) due to selection,
          // screen coords map directly to SVG coords.
          x = coords.x;
          y = coords.y;
      }
      
      audioService.playPop();
      createExplosion(x, y, task.color, task.size);
      
      if (coords) {
          // Came from overlay: bubble fades out in Overlay, just update state after delay
          setTimeout(() => {
             onToggleComplete(task);
             onEditTask(null as any);
          }, 150);
          return;
      }

      // Fallback: If not from overlay, animate the node itself
      popRing.style('opacity', 1).transition().duration(200).attr('stroke-dashoffset', 0);
      innerEl.transition().duration(150).ease(d3.easeBackIn.overshoot(2))
        .attr('transform', 'scale(1.2)')
        .style('opacity', 0)
        .on('end', () => {
             onToggleComplete(task);
             onEditTask(null as any);
        });
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
    const oldNodes: SimulationNode[] = simulationRef.current?.nodes() || [];
    
    const oldNodesMap = new Map<string, SimulationNode>(
      oldNodes.map(n => [n.id, n])
    );

    const nodes: SimulationNode[] = visibleTasks.map((task, index) => {
      const existing = oldNodesMap.get(task.id);
      let startX, startY;
      if (existing) {
          startX = existing.x;
          startY = existing.y;
      } else {
          const spawn = getOffScreenPos(width, height);
          startX = spawn.x;
          startY = spawn.y;
      }

      return {
        id: task.id,
        r: task.size,
        originalTask: task,
        x: startX,
        y: startY,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
      };
    });

    const centerNode: SimulationNode = {
      id: 'CENTER_BTN',
      r: CENTER_RADIUS,
      originalTask: {} as Task, 
      isCenter: true,
      fx: width / 2,
      fy: height / 2, 
      x: width/2,
      y: height/2
    };
    if(!nodes.find(n => n.id === 'CENTER_BTN')) nodes.push(centerNode);

    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation<SimulationNode>(nodes)
        .alphaMin(0.0001) 
        .alphaDecay(0.02); 
    } else {
      simulationRef.current.nodes(nodes);
      simulationRef.current.alpha(1).restart();
    }
    const simulation = simulationRef.current;

    const svg = d3.select(svgRef.current);
    
    // DEFINE GRADIENTS (Re-run when theme changes)
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
        defs = svg.append('defs');
    }

    // REMOVE OLD/EXISTING GRADIENTS
    defs.select('#center-glass-gradient').remove();
    defs.select('#center-glass-gradient-hover').remove();
    defs.select('#center-glass-stroke').remove();
    defs.select('#glass-highlight').remove();

    // 1. Center Body Gradient (Adaptive Glass)
    const centerGrad = defs.append('linearGradient')
        .attr('id', 'center-glass-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '100%');
    
    if (theme === 'dark') {
        centerGrad.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.12);
        centerGrad.append('stop').attr('offset', '100%').attr('stop-color', 'white').attr('stop-opacity', 0.06);
    } else {
        // Light Mode: Clearer, crystalline glass, now with higher opacity to pop against white BG
        centerGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.9);
        centerGrad.append('stop').attr('offset', '100%').attr('stop-color', '#e2e8f0').attr('stop-opacity', 0.6);
    }

    // 2. Center Hover Gradient
    const hoverGrad = defs.append('linearGradient')
        .attr('id', 'center-glass-gradient-hover')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '100%');

    if (theme === 'dark') {
        hoverGrad.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.25);
        hoverGrad.append('stop').attr('offset', '100%').attr('stop-color', 'white').attr('stop-opacity', 0.12);
    } else {
        hoverGrad.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.95);
        hoverGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f1f5f9').attr('stop-opacity', 0.7);
    }
    
    // 3. Center Border Gradient (Rim Light/Dark)
    const strokeGrad = defs.append('linearGradient')
        .attr('id', 'center-glass-stroke')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '100%');
    
    if (theme === 'dark') {
        strokeGrad.append('stop').attr('offset', '0%').attr('stop-color', 'white').attr('stop-opacity', 0.8);
        strokeGrad.append('stop').attr('offset', '40%').attr('stop-color', 'white').attr('stop-opacity', 0.2);
        strokeGrad.append('stop').attr('offset', '100%').attr('stop-color', 'white').attr('stop-opacity', 0.05);
    } else {
        // Sharp darker rim for definition in light mode
        strokeGrad.append('stop').attr('offset', '0%').attr('stop-color', '#94a3b8').attr('stop-opacity', 0.5);
        strokeGrad.append('stop').attr('offset', '100%').attr('stop-color', '#cbd5e1').attr('stop-opacity', 0.2);
    }

    // Task Color Gradients (Universal)
    const uniqueColors = Array.from(new Set(tasks.map(t => t.color).filter(Boolean)));
    uniqueColors.forEach((color: string) => {
        if (!color) return;
        const id = `grad-${color.replace('#', '')}`;
        if (defs.select(`#${id}`).empty()) {
            const grad = defs.append('linearGradient')
                .attr('id', id)
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '100%')
                .attr('y2', '100%');
            
            grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 1);
            grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(color)?.brighter(0.8)?.toString() || color).attr('stop-opacity', 1);
        }
    });

    const svgContent = svg.select('.canvas-content');
    const nodeSelection = svgContent.selectAll<SVGGElement, SimulationNode>('.node')
       .data(nodes, d => d.id);

    nodeSelection.exit()
       .transition().duration(600)
       .style('opacity', 0)
       .attr('transform', (d: any) => `translate(${d.x},${d.y}) scale(0.1)`)
       .remove();

    const enterGroup = nodeSelection.enter()
       .append('g')
       .attr('class', d => `node cursor-pointer group ${d.isCenter ? 'center-node' : ''}`)
       .attr('id', d => `node-${d.id}`);
    
    // Structure: node -> inner-scale -> shake-group -> [rings, bubble, content]
    const inner = enterGroup.append('g').attr('class', 'inner-scale transition-transform duration-75');
    const shaker = inner.append('g').attr('class', 'shake-group'); // Wrapper for vibration

    shaker.append('circle')
        .attr('class', 'pop-ring')
        .attr('fill', 'none')
        .attr('stroke', theme === 'dark' ? '#ffffff' : '#64748b')
        .attr('stroke-width', 4)
        .attr('opacity', 0)
        .style('pointer-events', 'none')
        .attr('r', d => d.r)
        .attr('stroke-dasharray', d => 2 * Math.PI * d.r)
        .attr('stroke-dashoffset', d => 2 * Math.PI * d.r)
        .attr('transform', 'rotate(-90)');

    shaker.append('circle')
       .attr('class', 'main-bubble transition-colors duration-300')
       .attr('stroke-width', 0);

    shaker.append('g').attr('class', 'text-content pointer-events-none')
         .append('foreignObject').append('xhtml:div')
         .attr('class', 'w-full h-full flex flex-col items-center justify-center text-center overflow-hidden bubble-text-container')
         .html(d => `<div class="bubble-text font-bold leading-tight select-none drop-shadow-lg px-0.5" style="overflow-wrap: normal; word-break: normal; hyphens: none; white-space: pre-line; line-height: 1.1;"></div>`);

    inner.filter(d => !!d.isCenter)
       .append('foreignObject')
       .attr('class', 'center-btn-container pointer-events-none') 
       .append('xhtml:div')
       .attr('class', 'w-full h-full flex items-center justify-center text-white center-icon')
       .html('');

    const allNodes = enterGroup.merge(nodeSelection);
    
    allNodes.filter(d => !!d.isCenter).raise();
    
    const isMobile = dimensions.width < 768;
    allNodes.filter(d => !!d.isCenter).select('.center-btn-container')
       .attr('width', isMobile ? 80 : 48)
       .attr('height', isMobile ? 80 : 48)
       .attr('x', isMobile ? -40 : -24)
       .attr('y', isMobile ? -40 : -24);
       
    // Ultra-thin Plus Icon
    // Center icon color needs to adapt to theme
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
        .attr('stroke', d => {
            if (d.isCenter) return 'url(#center-glass-stroke)';
            return 'none';
        })
        .attr('stroke-width', d => d.isCenter ? null : 0) 
        .style('filter', d => d.isCenter 
             ? (theme === 'dark' 
                ? 'drop-shadow(0px 8px 32px rgba(0,0,0,0.25))' 
                : 'drop-shadow(0px 8px 24px rgba(0,0,0,0.15))') 
             : (theme === 'dark'
                ? 'drop-shadow(0px 10px 20px rgba(0,0,0,0.2))'
                : 'drop-shadow(0px 4px 16px rgba(148, 163, 184, 0.4))') // Slate colored shadow for better aesthetics on light mode
        )
        .attr('class', d => `main-bubble transition-colors duration-300 ${d.isCenter ? 'backdrop-blur-xl' : 'backdrop-blur-sm'}`);

    allNodes.select('.pop-ring')
        .attr('r', d => d.r + 3)
        .attr('stroke', theme === 'dark' ? '#ffffff' : '#64748b')
        .attr('stroke-dasharray', d => 2 * Math.PI * (d.r + 3))
        .attr('stroke-dashoffset', d => 2 * Math.PI * (d.r + 3));

    // STRICT SQUARE LAYOUT
    allNodes.select('.text-content foreignObject')
        // Using 1.38 which is slightly larger than 1.3 but safely within sqrt(2) approx 1.41
        .attr('width', d => d.r * 1.38)
        .attr('height', d => d.r * 1.38)
        .attr('x', d => -d.r * 0.69)
        .attr('y', d => -d.r * 0.69);

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
                
                const isToday = date.getDate() === now.getDate() &&
                                date.getMonth() === now.getMonth() &&
                                date.getFullYear() === now.getFullYear();

                const dateStr = isToday 
                    ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                const dateSize = Math.max(9, d.r * 0.18);
                const pillColor = isOverdue ? 'rgba(239, 68, 68, 0.9)' : 'rgba(0, 0, 0, 0.2)';
                
                // Using inline-block wrapper for the pill effect
                html += `
                <div style="margin-top: 6px;">
                    <div style="
                        display: inline-block; 
                        background: ${pillColor}; 
                        padding: 2px 8px; 
                        border-radius: 99px; 
                        font-size: ${dateSize}px; 
                        color: white; 
                        font-weight: 600; 
                        letter-spacing: 0.02em;
                        backdrop-filter: blur(4px);
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    ">
                        ${dateStr}
                    </div>
                </div>`;
            }
            
            if (subtaskCount > 0) {
                html += `<div style="margin-top: 4px; font-size: ${d.r * 0.2}px; opacity: 0.8; font-weight: 600;">${completedSubtasks}/${subtaskCount}</div>`;
            }
            
            return html;
        });

    allNodes.select('.bubble-text')
        .style('color', d => {
            if (d.originalTask.completed) return theme === 'dark' ? '#94a3b8' : '#64748b';
            return '#ffffff'; // Colored bubbles always use white text
        })
        .style('font-size', d => {
            let size = calculateFontSize(d.r, d.originalTask.title);
            // If we have extra metadata lines, reduce main text size slightly to make room
            if (d.originalTask.dueDate || (d.originalTask.subtasks && d.originalTask.subtasks.length > 0)) {
                size = size * 0.85;
            }
            return `${size}px`;
        })
        .style('opacity', d => d.originalTask.completed ? 0.6 : 1)
        .style('text-decoration', d => d.originalTask.completed ? 'line-through' : 'none');

    allNodes.style('pointer-events', d => d.id === selectedTaskId ? 'none' : 'all');
    
    // Reset transforms when not selected
    allNodes.select('.inner-scale').style('opacity', d => d.id === selectedTaskId ? 0 : 1).attr('transform', 'scale(1)');

    simulation.on('tick', () => {
       // HARD CONSTRAINT: Prevent center overlap
       const cx = dimensions.width / 2;
       const cy = dimensions.height / 2;
       const hardCenterBuffer = 10; 
       
       nodes.forEach(node => {
          if (node.isCenter || node.id === selectedTaskId) return;
          if (node.x === undefined || node.y === undefined) return;

          const dx = node.x - cx;
          const dy = node.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDistance = CENTER_RADIUS + node.r + hardCenterBuffer;

          if (dist < minDistance) {
              const angle = dist === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
              const tx = Math.cos(angle) * minDistance;
              const ty = Math.sin(angle) * minDistance;
              
              node.x = cx + tx;
              node.y = cy + ty;
              
              if (node.vx && node.vy) {
                  node.vx *= 0.5;
                  node.vy *= 0.5;
              }
          }
       });

       allNodes.attr('transform', d => `translate(${d.x},${d.y})`);

       if (zoomBehavior.current && svgRef.current) {
           const cx = dimensions.width / 2;
           const cy = dimensions.height / 2;
           let maxDistX = 0, maxDistY = 0;
           nodes.forEach(n => {
              if (n.x === undefined || n.y === undefined) return;
              const distHalfW = Math.abs(n.x - cx) + n.r + 60; 
              const distHalfH = Math.abs(n.y - cy) + n.r + 60;
              if (distHalfW > maxDistX) maxDistX = distHalfW;
              if (distHalfH > maxDistY) maxDistY = distHalfH;
           });
           
           if (maxDistX > 0 && maxDistY > 0) {
               const scaleX = dimensions.width / (maxDistX * 2); 
               const scaleY = dimensions.height / (maxDistY * 2);
               let targetK = Math.min(scaleX, scaleY) * 0.95; 
               targetK = Math.min(Math.max(targetK, 0.25), AUTO_SCALE_MAX); 
               
               const targetX = cx * (1 - targetK);
               const targetY = cy * (1 - targetK);
               
               fitStateRef.current = { k: targetK, x: targetX, y: targetY };
               
               if (isAutoScaling && !selectedTaskId && !isUserInteracting.current) {
                   const current = transformRef.current;
                   const smooth = 0.05; 
                   const k = current.k + (targetK - current.k) * smooth;
                   const x = current.x + (targetX - current.x) * smooth;
                   const y = current.y + (targetY - current.y) * smooth;

                   if (Math.abs(k - current.k) > 0.0001 || Math.abs(x - current.x) > 0.1 || Math.abs(y - current.y) > 0.1) {
                       const newTransform = d3.zoomIdentity.translate(x, y).scale(k);
                       d3.select(svgRef.current).call(zoomBehavior.current.transform, newTransform);
                   }
               }
           }
       }
    });

    return () => { simulation.stop(); };
  }, [tasks, showCompleted, selectedTaskId, isAutoScaling, dimensions, clearHoldTimer, theme]);

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
        })
        .strength(1)
        .iterations(40)
     );

     sim.velocityDecay(PHYSICS.vDecay);
     sim.alpha(0.8).restart();
  }, [dimensions, selectedTaskId]);

  const handleResetView = useCallback(() => {
    ensureAudio();
    setIsAutoScaling(true);
    if (simulationRef.current) simulationRef.current.alpha(0.3).restart();
  }, []);

  const selectedTask = activeTask || tasks.find(t => t.id === selectedTaskId);

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

        /* Pulse Animation for Auto Scale Button Icon */
        @keyframes pulse-icon {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
        }
        .animate-pulse-icon {
            animation: pulse-icon 2s ease-in-out infinite;
        }

        /* Center Node Styles */
        .center-node .main-bubble {
            stroke-width: 1.2px;
            transition: all 0.3s ease;
        }
        .center-node:hover .main-bubble {
            fill: url(#center-glass-gradient-hover) !important;
            stroke: ${theme === 'dark' ? 'white' : '#94a3b8'} !important;
            stroke-width: 1.5px !important;
        }
        /* Icon Animation */
        .center-node .center-icon {
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .center-node:hover .center-icon {
            transform: scale(1.1);
        }
      `}</style>
      
      {/* AMBIENT BACKGROUND BLOBS - Adapted Opacity for Light Mode */}
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
            <div className={`absolute inset-0 z-20 animate-fade-in cursor-pointer
                ${theme === 'dark' ? 'bg-black/40 backdrop-blur-sm' : 'bg-slate-200/40 backdrop-blur-sm'}`} 
                onClick={() => onEditTask(null as any)} />
            <div className="absolute inset-0 z-30 pointer-events-none">
                 <BubbleControls 
                    task={selectedTask}
                    boards={boards}
                    startPos={editStartPos}
                    onUpdate={(t) => onEditTask(t)}
                    onDelete={onDeleteTask}
                    onClose={() => onEditTask(null as any)}
                    onPop={(coords) => handleProgrammaticPop(selectedTask, coords)}
                 />
            </div>
          </>
      )}

      {!selectedTaskId && (
          <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-50 items-center">
            {showEyeButton && (
                <button 
                onClick={onToggleShowCompleted} 
                className={`p-3 rounded-2xl transition-all shadow-lg active:scale-95
                    bg-white/80 dark:bg-slate-900/20 
                    hover:bg-white dark:hover:bg-slate-900/40 
                    text-slate-700 dark:text-white/80 
                    border border-slate-200 dark:border-white/10 
                    backdrop-blur-xl
                    ${isShowingCompleted 
                        ? (theme === 'dark' ? 'bg-white/10 text-white border-white/30' : 'bg-white text-slate-900 border-white/60') 
                        : ''}
                `}
                >
                {isShowingCompleted ? <Eye size={22} /> : <EyeOff size={22} />}
                </button>
            )}

            <button 
            onClick={handleResetView} 
            className={`p-3 rounded-2xl transition-all shadow-lg active:scale-95
                ${isAutoScaling 
                    ? 'bg-blue-500/10 border-blue-200 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:bg-blue-500/20 dark:bg-blue-500/30 dark:border-blue-400/50 dark:text-blue-100' 
                    : 'bg-white/80 dark:bg-slate-900/20 hover:bg-white dark:hover:bg-slate-900/40 text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/10 backdrop-blur-xl'}
                `}
            >
            <Maximize size={22} className={!isAutoScaling ? 'animate-pulse-icon' : ''} />
            </button>
        </div>
      )}
    </div>
  );
}