/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  Send, 
  Sparkles, 
  Layout, 
  Image as ImageIcon, 
  Code, 
  Smartphone, 
  Monitor, 
  Layers,
  ChevronRight,
  Terminal,
  Zap,
  Palette,
  ExternalLink,
  ChevronDown,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '@/src/lib/utils';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'ui-plan' | 'image-gen' | 'image-input';
  imageUrl?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  messages: Message[];
  versions: string[];
  currentVersionIndex: number;
  createdAt: number;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('nexus_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const saved = localStorage.getItem('nexus_active_project_id');
    return saved || null;
  });

  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [buildProgress, setBuildProgress] = useState<{ 
    step: string; 
    percent: number;
    subTasks?: { label: string; status: 'pending' | 'active' | 'completed' }[];
  } | null>(null);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'assets'>('preview');
  const [activeMobileView, setActiveMobileView] = useState<'chat' | 'preview'>('chat');
  const [isBuilding, setIsBuilding] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showProjectSidebar, setShowProjectSidebar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const messages = activeProject?.messages || [
    {
      role: 'assistant',
      content: "Welcome to **Nexus AI Builder**. I'm optimized for high-fidelity UI/UX design and rapid full-stack prototyping. Tell me what you want to build, and I'll generate the structure, design assets, and code logic.",
      type: 'text'
    }
  ];
  const previewCode = activeProject?.versions[activeProject.currentVersionIndex] || null;

  // Persistence
  useEffect(() => {
    localStorage.setItem('nexus_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem('nexus_active_project_id', activeProjectId);
    }
  }, [activeProjectId]);

  const createNewProject = () => {
    const newProject: Project = {
      id: Math.random().toString(36).substring(7),
      name: 'New Prototype',
      description: '',
      messages: [
        {
          role: 'assistant',
          content: "Welcome to your new **Nexus Prototype**. What are we building today?",
          type: 'text'
        }
      ],
      versions: [],
      currentVersionIndex: -1,
      createdAt: Date.now()
    };
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setActiveMobileView('chat');
    setShowProjectSidebar(false);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
  };

  const openFullScreen = () => {
    if (!previewCode) return;
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://unpkg.com/lucide@latest"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; overflow-x: hidden; background: #000; color: #fff; }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script>
            (function() {
              try {
                const code = \`${previewCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/<\/script>/gi, '<\\/script>')}\`;
                if (code.trim().startsWith('<')) {
                  document.getElementById('root').innerHTML = code;
                  const scripts = document.getElementById('root').querySelectorAll('script');
                  scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                  });
                  if (window.lucide) {
                    lucide.createIcons();
                  }
                }
              } catch (e) {
                document.getElementById('root').innerHTML = '<div class="p-8 text-red-500 font-mono">Render Error: ' + e.message + '</div>';
              }
            })();
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBuilding, isLoading]);

  const generateImage = async (prompt: string) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `High-quality UI design asset, modern aesthetic, professional, clean: ${prompt}` }]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    } catch (error) {
      console.error("Image generation failed:", error);
    }
    return null;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input, 
      type: selectedImage ? 'image-input' : 'text',
      imageUrl: selectedImage || undefined
    };
    
    // Update local messages immediately for UX
    let updatedMessages = [...messages, userMessage];
    
    // If no active project, create one
    let currentProjectId = activeProjectId;
    if (!currentProjectId) {
      const newId = Math.random().toString(36).substring(7);
      const newProject: Project = {
        id: newId,
        name: 'Analyzing...',
        description: input || 'Image Analysis',
        messages: updatedMessages,
        versions: [],
        currentVersionIndex: -1,
        createdAt: Date.now()
      };
      setProjects(prev => [newProject, ...prev]);
      setActiveProjectId(newId);
      currentProjectId = newId;

      // Generate a creative name in the background
      ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ role: 'user', parts: [{ text: `Generate a creative, professional, and unique name for an app based on this prompt: "${input || 'Visual Analysis'}". Return ONLY the name, no quotes or extra text.` }] }]
      }).then(res => {
        const generatedName = res.text?.trim() || 'New Prototype';
        setProjects(prev => prev.map(p => p.id === newId ? { ...p, name: generatedName } : p));
      }).catch(() => {
        setProjects(prev => prev.map(p => p.id === newId ? { ...p, name: 'New Prototype' } : p));
      });
    } else {
      setProjects(prev => prev.map(p => 
        p.id === currentProjectId ? { ...p, messages: updatedMessages } : p
      ));
    }

    const currentImage = selectedImage;
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);
    setBuildProgress({ step: 'Analyzing Architecture', percent: 5 });

    try {
      const buildKeywords = [
        'build', 'create', 'make', 'generate', 'design', 'ui', 'app', 'site', 'page', 
        'component', 'game', 'program', 'prototype', 'landing', 'dashboard', 'interface',
        'replicate', 'clone', 'mockup', 'wireframe', 'snake', 'calculator', 'todo', 'add', 'change', 'fix', 'update', 'iterate'
      ];
      const isBuildRequest = buildKeywords.some(k => input.toLowerCase().includes(k)) || input.length > 50 || currentImage;

      if (isBuildRequest) {
        setActiveMobileView('preview');
        setActiveTab('preview');
        setIsBuilding(true);
        
        // Start parallel diffusion simulation
        setBuildProgress({ 
          step: 'Initializing Diffusion Forge', 
          percent: 5,
          subTasks: [
            { label: 'Neural Architecture Mapping', status: 'pending' },
            { label: 'Parallel Component Diffusion', status: 'pending' },
            { label: 'Logic Backstitching', status: 'pending' },
            { label: 'High-Fidelity Asset Synthesis', status: 'pending' }
          ]
        });

        const diffusionInterval = setInterval(() => {
          setBuildProgress(prev => {
            if (!prev) return null;
            const newPercent = Math.min(prev.percent + (Math.random() * 12), 98);
            
            const newSubTasks = prev.subTasks?.map((task, i) => {
              if (newPercent > (i + 1) * 24) return { ...task, status: 'completed' as const };
              if (newPercent > i * 20) return { ...task, status: 'active' as const };
              return task;
            });

            let newStep = prev.step;
            if (newPercent > 92) newStep = 'Synthesizing Final Build';
            else if (newPercent > 75) newStep = 'Backstitching Logic Layers';
            else if (newPercent > 50) newStep = 'Diffusing UI Components';
            else if (newPercent > 25) newStep = 'Mapping Skeleton Tree';
            else if (newPercent > 10) newStep = 'Neural Architecture Mapping';

            return { ...prev, percent: Math.round(newPercent), step: newStep, subTasks: newSubTasks };
          });
        }, 500);

        // 1. Generate Text Response/Plan
        const contents = updatedMessages.map(m => {
          const parts: any[] = [{ text: m.content || (m.type === 'image-input' ? "Analyze this image." : "") }];
          if (m.imageUrl && m.role === 'user' && m.type === 'image-input') {
            parts.push({
              inlineData: {
                data: m.imageUrl.split(',')[1],
                mimeType: "image/png"
              }
            });
          }
          return { role: m.role === 'user' ? 'user' : 'model', parts };
        });

        if (previewCode) {
          contents.push({ 
            role: 'user', 
            parts: [{ text: `CONTEXT: Here is the current code of the prototype we are working on. Please iterate on this code based on my latest request:\n\n\`\`\`html\n${previewCode}\n\`\`\`` }] 
          });
        }

        const textResponse = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents,
          config: {
            systemInstruction: `You are Nexus AI, the world's most advanced "Diffusion Builder". 
            Your core philosophy is to build everything at once (UI, logic, state, assets) and then stitch them together.
            
            ITERATION MODE:
            If the user provides "CONTEXT: Here is the current code...", you MUST analyze the existing code and apply the requested changes or additions. 
            DO NOT start from scratch if context is provided. Maintain the existing design language and logic unless asked to change it.
            Your response should be a DELTA update - keep what works, improve what doesn't.

            VISUAL CONTEXT:
            If the user provides an image, use it to understand the current state of the UI, identify bugs, or replicate a specific design style. 
            The image is a direct reference of what the user sees or wants. Use it to diagnose issues or align with the user's visual feedback.
            
            PROJECT CONTEXT:
            You are currently working on a project named "${activeProject?.name || 'Untitled'}".
            Description: ${activeProject?.description || 'No description provided.'}
            
            CRITICAL DIRECTIVES:
            1. ALWAYS enter "BUILD MODE" for any request to create, design, or build something.
            2. Output EXACTLY ONE block of code wrapped in \`\`\`html ... \`\`\`.
            3. This code MUST be a complete, self-contained, and functional prototype.
            4. Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>.
            5. Use Lucide icons via CDN: <script src="https://unpkg.com/lucide@latest"></script>.
            6. After your code, you MUST call \`lucide.createIcons();\` in a script tag if you use icons.
            7. DESIGN QUALITY: The UI must be "Ultra-High-End, Modern, and Professional". 
               - DO NOT stick to the Nexus AI theme (orange/black).
               - Choose a unique, creative, and consistent color palette that fits the specific app or job being built.
               - Use sophisticated color combinations (e.g., deep purples and cyans for tech, warm earth tones for lifestyle, clean whites and blues for corporate).
               - Maintain high contrast and accessibility.
               - Use glassmorphism (backdrop-blur, border-white/10) where appropriate.
               - Use bold, expressive typography (Inter 900 or relevant professional fonts).
               - EVERYTHING must be inside a styled <div>.
            8. RESPONSIVE DESIGN: All UI must be fully responsive. 
               - Use Tailwind's mobile-first utilities (sm:, md:, lg:).
               - EXPLICITLY change layouts for different screen sizes (e.g., stack on mobile, grid on desktop).
            9. INTERACTIVITY: For games or interactive apps, you MUST include a full game loop or state management using vanilla JS. 
               - Use <canvas> for games to ensure high performance.
               - Ensure buttons have hover and active states.
            10. DO NOT output multiple code blocks. DO NOT output partial code.
            11. After the code block, you MUST provide a detailed "🛠️ NEXUS BUILD LOG" using Markdown headers:
                ### 🛠️ NEXUS BUILD LOG
                - **Core Features**: [Detailed list of functional components]
                - **Technical Implementation**: [Deep dive into logic, e.g., "Asynchronous state management", "Canvas physics engine"]
                - **Design Choices**: [Explanation of aesthetic and UX decisions]
            12. IMPORTANT: Your text response in the chat should ONLY summarize the features you created. DO NOT include raw code in your text explanation.
            13. LAYOUT: Ensure your UI fills the entire viewport. Use \`min-h-screen\` or \`h-screen\` on your root container.
            
            NEXUS DESIGN SYSTEM (Base Guidelines - Adapt Colors):
            - Root Container: Use a background color that fits your chosen theme.
            - Card Style: Use semi-transparent backgrounds with backdrop-blur and subtle borders.
            - Accent Button: Use a primary accent color from your palette with hover and active states.
            - Heading: Use strong, tracking-tight typography.`,
          },
        });

        clearInterval(diffusionInterval);
        setBuildProgress(prev => prev ? { ...prev, step: 'Build Complete', percent: 100 } : null);
        
        setTimeout(() => {
          setIsBuilding(false);
          setBuildProgress(null);
        }, 1000);

        const rawContent = textResponse.text || "";
        const codeMatch = rawContent.match(/```(?:html|jsx|tsx|javascript|typescript)?\n([\s\S]*?)```/i);
        
        let displayContent = rawContent;
        let newCode = previewCode;

        if (codeMatch) {
          newCode = codeMatch[1];
          displayContent = rawContent.replace(/```(?:html|jsx|tsx|javascript|typescript)?\n[\s\S]*?```/i, '').trim();
          if (!displayContent) {
            displayContent = "I've successfully diffused the prototype. You can view the live build and source code in the preview panel.";
          }
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: displayContent,
          type: 'ui-plan'
        };

        setProjects(prev => prev.map(p => {
          if (p.id === currentProjectId) {
            const newVersions = codeMatch ? [...p.versions, newCode!] : p.versions;
            return {
              ...p,
              messages: [...updatedMessages, assistantMessage],
              versions: newVersions,
              currentVersionIndex: newVersions.length - 1,
            };
          }
          return p;
        }));

      } else {
        // Just a regular question
        const textResponse = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: updatedMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
          config: {
            systemInstruction: "You are Nexus AI, a helpful assistant. Answer the user's question clearly and concisely.",
          },
        });

        const assistantMessage: Message = {
          role: 'assistant',
          content: textResponse.text || "I'm processing your request...",
          type: 'text'
        };

        setProjects(prev => prev.map(p => 
          p.id === currentProjectId ? { ...p, messages: [...updatedMessages, assistantMessage] } : p
        ));
      }

    } catch (error) {
      console.error("Generation failed:", error);
      setProjects(prev => prev.map(p => 
        p.id === currentProjectId ? { 
          ...p, 
          messages: [...p.messages, {
            role: 'assistant',
            content: "I encountered an error while building. Please try again.",
            type: 'text'
          }] 
        } : p
      ));
    } finally {
      setIsLoading(false);
      setBuildProgress(null);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#0A0A0A] text-[#F5F5F4] font-sans selection:bg-orange-500/30 overflow-hidden relative">
      {/* Project Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-[#050505] border-r border-white/10 z-[60] transition-transform duration-300 md:relative md:translate-x-0",
        showProjectSidebar ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-500" />
              <span className="font-black uppercase tracking-tighter italic">Prototypes</span>
            </div>
            <button 
              onClick={() => setShowProjectSidebar(false)}
              className="md:hidden p-2 text-white/40"
            >
              <ChevronDown className="w-5 h-5 rotate-90" />
            </button>
          </div>

          <div className="p-4">
            <button 
              onClick={createNewProject}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest"
            >
              <Sparkles className="w-4 h-4 text-orange-500" />
              New Prototype
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {projects.map(p => (
              <div 
                key={p.id}
                onClick={() => {
                  setActiveProjectId(p.id);
                  setActiveMobileView('chat');
                  setShowProjectSidebar(false);
                }}
                className={cn(
                  "group relative p-4 rounded-xl border transition-all cursor-pointer",
                  activeProjectId === p.id 
                    ? "bg-orange-600/10 border-orange-600/50" 
                    : "bg-white/5 border-white/5 hover:border-white/20"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 overflow-hidden">
                    <h4 className={cn(
                      "text-[10px] font-bold line-clamp-2 uppercase tracking-tight leading-tight",
                      activeProjectId === p.id ? "text-orange-500" : "text-white/80"
                    )}>
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-white/30 truncate">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newName = prompt('Enter new prototype name:', p.name);
                          if (newName) {
                            setProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, name: newName } : proj));
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-orange-500 transition-all"
                      >
                        <Palette className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => deleteProject(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                      >
                        <Zap className="w-3 h-3 rotate-180" />
                      </button>
                    </div>
                </div>
                {p.versions.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="px-1.5 py-0.5 bg-white/10 rounded text-[8px] font-black text-white/40">
                      V{p.versions.length}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {showProjectSidebar && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] md:hidden"
          onClick={() => setShowProjectSidebar(false)}
        />
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative h-full">
        {/* Sidebar - Chat Interface */}
        <aside className={cn(
          "w-full md:w-[400px] lg:w-[450px] border-r border-white/10 flex flex-col bg-[#0F0F0F] relative z-10 shadow-2xl transition-all duration-300 h-full overflow-hidden",
          activeMobileView === 'chat' ? "flex" : "hidden md:flex"
        )}>
        <header className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowProjectSidebar(true)}
              className="p-2 -ml-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
            >
              <Layout className="w-5 h-5 text-orange-500" />
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Nexus AI</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest border border-orange-500/30 px-2 py-0.5 rounded-full bg-orange-500/10 shadow-[0_0_10px_rgba(234,88,12,0.1)]">Responsive Optimized</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-bold">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Build
          </div>
        </header>

        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth min-h-0"
        >
          {activeProject && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 mb-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500">Active Prototype</h3>
                <span className="text-[8px] font-mono text-white/20">ID: {activeProject.id}</span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white/90">{activeProject.name}</h2>
              {activeProject.description && (
                <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 italic">
                  "{activeProject.description}"
                </p>
              )}
            </motion.div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex flex-col gap-3",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}
              >
                <div className={cn(
                  "max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-orange-600 text-white rounded-tr-none" 
                    : "bg-white/5 border border-white/10 rounded-tl-none"
                )}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                  
                  {msg.imageUrl && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 rounded-xl overflow-hidden border border-white/10 shadow-lg"
                    >
                      <img 
                        src={msg.imageUrl} 
                        alt={msg.role === 'user' ? "User Upload" : "AI Generated Concept"} 
                        className="w-full h-auto object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="p-2 bg-black/50 backdrop-blur-md text-[10px] uppercase tracking-wider flex items-center gap-2">
                        {msg.role === 'user' ? (
                          <>
                            <ImageIcon className="w-3 h-3 text-blue-400" />
                            User Reference Image
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-orange-400" />
                            Diffusion Engine Output
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
                <span className="text-[10px] text-white/20 uppercase tracking-widest font-medium">
                  {msg.role === 'user' ? 'You' : 'Nexus Assistant'}
                </span>
              </motion.div>
            ))}
            {buildProgress && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full p-5 bg-orange-600/5 border border-orange-600/20 rounded-2xl space-y-4 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Zap className="w-4 h-4 text-orange-500 animate-pulse" />
                      <div className="absolute inset-0 bg-orange-500/20 blur-sm animate-pulse" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Diffusion Forge</span>
                  </div>
                  <span className="text-[10px] font-mono text-orange-500/60 font-bold">{buildProgress.percent}%</span>
                </div>

                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${buildProgress.percent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">{buildProgress.step}</span>
                  </div>

                  {buildProgress.subTasks && (
                    <div className="grid grid-cols-1 gap-2 pl-3.5 border-l border-white/10">
                      {buildProgress.subTasks.map((task, i) => (
                        <div key={i} className="flex items-center justify-between group">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-1 h-1 rounded-full transition-all duration-500",
                              task.status === 'completed' ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" :
                              task.status === 'active' ? "bg-orange-500 animate-pulse" : "bg-white/10"
                            )} />
                            <span className={cn(
                              "text-[9px] uppercase tracking-wider transition-colors duration-300",
                              task.status === 'completed' ? "text-white/60" :
                              task.status === 'active' ? "text-orange-400 font-bold" : "text-white/20"
                            )}>
                              {task.label}
                            </span>
                          </div>
                          {task.status === 'completed' && (
                            <motion.div 
                              initial={{ scale: 0 }} 
                              animate={{ scale: 1 }}
                              className="text-[8px] text-green-500 font-bold"
                            >
                              READY
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={scrollToBottom}
              className="absolute bottom-32 right-8 p-2 bg-orange-600 text-white rounded-full shadow-lg z-30 hover:bg-orange-500 transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>

        <div className="p-6 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F] to-transparent shrink-0 pb-24 md:pb-6">
          {selectedImage && (
            <div className="mb-4 relative inline-block">
              <img src={selectedImage} className="h-20 w-20 object-cover rounded-xl border border-white/20" alt="Selected" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="relative group">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Describe your UI vision or upload an image..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pr-24 text-sm focus:outline-none focus:border-orange-500/50 transition-all resize-none h-24 group-hover:bg-white/[0.07] min-h-[44px]"
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-white/40 hover:text-white"
                title="Upload Image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className="p-3 bg-orange-600 rounded-xl hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600 transition-all shadow-lg shadow-orange-600/20"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-center text-white/30 tracking-wide hidden lg:block">
            Nexus AI uses Gemini 3.1 Pro & Diffusion for rapid full-stack generation.
          </p>
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className={cn(
        "flex-1 flex flex-col bg-[#050505] relative transition-all duration-300 pb-16 md:pb-0",
        activeMobileView === 'preview' ? "flex" : "hidden md:flex"
      )}>
        {/* Toolbar */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-[#0A0A0A]/80 backdrop-blur-xl z-20 shrink-0">
          <div className="flex items-center gap-2 md:gap-6">
            <button 
              onClick={() => setShowProjectSidebar(true)}
              className="md:hidden p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
            >
              <Layout className="w-4 h-4 text-orange-500" />
            </button>
            <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setActiveTab('preview')}
                className={cn(
                  "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all flex items-center gap-2",
                  activeTab === 'preview' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
                )}
              >
                <Layout className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </button>
              <button 
                onClick={() => setActiveTab('code')}
                className={cn(
                  "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all flex items-center gap-2",
                  activeTab === 'code' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
                )}
              >
                <Code className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Code</span>
              </button>
              <button 
                onClick={() => setActiveTab('assets')}
                className={cn(
                  "px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all flex items-center gap-2",
                  activeTab === 'assets' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
                )}
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Assets</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {activeProject && activeProject.versions.length > 1 && (
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <button 
                  onClick={() => {
                    const newIndex = Math.max(0, activeProject.currentVersionIndex - 1);
                    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, currentVersionIndex: newIndex } : p));
                  }}
                  disabled={activeProject.currentVersionIndex === 0}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white disabled:opacity-20"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <span className="text-[10px] font-black font-mono px-2">
                  V{activeProject.currentVersionIndex + 1} / {activeProject.versions.length}
                </span>
                <button 
                  onClick={() => {
                    const newIndex = Math.min(activeProject.versions.length - 1, activeProject.currentVersionIndex + 1);
                    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, currentVersionIndex: newIndex } : p));
                  }}
                  disabled={activeProject.currentVersionIndex === activeProject.versions.length - 1}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white disabled:opacity-20"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setViewMode('desktop')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'desktop' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('mobile')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'mobile' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-4 md:p-12 flex items-center justify-center overflow-hidden relative">
          {/* Background Decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
          </div>

          <motion.div
            layout
            className={cn(
              "bg-[#111] border border-white/10 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500 ease-out",
              viewMode === 'desktop' ? "w-full h-full max-w-5xl max-h-[80%]" : "w-[320px] h-[568px] md:w-[375px] md:h-[667px]"
            )}
          >
            {activeTab === 'preview' ? (
              <div className="w-full h-full flex flex-col">
                <div className="h-10 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-white/5 px-4 py-1 rounded-md text-[10px] text-white/30 font-mono">
                      nexus-preview.app
                    </div>
                  </div>
                  <button 
                    onClick={openFullScreen}
                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white"
                    title="Open in Full Screen"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className={cn(
                  "flex-1 flex flex-col overflow-hidden relative",
                  (messages.length > 1 || activeProject) ? "justify-start" : "items-center justify-center text-center p-6 md:p-12"
                )}>
                  {isLoading || buildProgress || isBuilding ? (
                    <div className="space-y-8 flex flex-col items-center justify-center h-full w-full max-w-md mx-auto p-6">
                      <div className="relative">
                        <div className="w-24 h-24 border-4 border-orange-600/10 border-t-orange-600 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Zap className="w-10 h-10 text-orange-600 animate-pulse" />
                        </div>
                        <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.8)]" />
                        </div>
                      </div>
                      
                      <div className="space-y-4 text-center w-full">
                        <div className="space-y-1">
                          <p className="text-white font-black tracking-[0.3em] uppercase text-[10px]">Nexus Diffusion Forge</p>
                          <p className="text-orange-500 text-xs font-bold animate-pulse uppercase tracking-widest">
                            {buildProgress?.step || "Diffusing Program Logic..."}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : previewCode ? (
                    <div className="w-full h-full relative group">
                      <iframe
                        title="Nexus Preview"
                        className="w-full h-full bg-white"
                        srcDoc={`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta charset="UTF-8">
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                              <script src="https://cdn.tailwindcss.com"></script>
                              <script src="https://unpkg.com/lucide@latest"></script>
                              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
                              <style>
                                body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; overflow-x: hidden; }
                                ::-webkit-scrollbar { width: 6px; }
                                ::-webkit-scrollbar-track { background: transparent; }
                                ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                                ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
                              </style>
                            </head>
                            <body>
                              <div id="root"></div>
                              <script>
                                (function() {
                                  try {
                                    const code = \`${previewCode ? previewCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/<\/script>/gi, '<\\/script>') : ''}\`;
                                    const root = document.getElementById('root');
                                    
                                    if (code.trim().toLowerCase().startsWith('<!doctype') || code.trim().toLowerCase().startsWith('<html')) {
                                      document.open();
                                      document.write(code);
                                      document.close();
                                      return;
                                    }

                                    if (code.trim().startsWith('<')) {
                                      root.innerHTML = code;
                                      const scripts = root.querySelectorAll('script');
                                      scripts.forEach(oldScript => {
                                        const newScript = document.createElement('script');
                                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                                        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                                        oldScript.parentNode.replaceChild(newScript, oldScript);
                                      });
                                      if (window.lucide) {
                                        lucide.createIcons();
                                      }
                                    }
                                  } catch (e) {
                                    console.error('Nexus Build Error:', e);
                                  }
                                })();
                              </script>
                            </body>
                          </html>
                        `}
                      />
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[8px] font-black uppercase tracking-widest text-orange-500">
                          Live Build Active
                        </div>
                      </div>
                    </div>
                  ) : activeProject ? (
                    <div className="w-full h-full space-y-8 p-6 md:p-12 overflow-y-auto">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">Live Prototype</h2>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Active Build Session</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                          <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                            <div className="w-12 h-12 bg-orange-600/20 rounded-2xl flex items-center justify-center">
                              <Layers className="w-6 h-6 text-orange-500" />
                            </div>
                            <h3 className="text-lg font-bold tracking-tight">System Architecture</h3>
                            <p className="text-sm text-white/40 leading-relaxed">
                              The parallel diffusion engine has mapped the core logic to a distributed state management system.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          {messages.filter(m => m.type === 'image-gen').slice(-1).map((m, i) => (
                            <div key={i} className="relative group rounded-3xl overflow-hidden border border-white/10">
                              <img 
                                src={m.imageUrl} 
                                className="w-full aspect-square object-cover" 
                                alt="UI Concept"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 max-w-md">
                      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10">
                        <Terminal className="w-10 h-10 text-white/20" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-semibold tracking-tight">Ready to Forge</h2>
                        <p className="text-white/40 text-sm leading-relaxed">
                          Enter a prompt to generate high-fidelity UI components, layouts, and backend logic.
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['SaaS Landing Page', 'Crypto Dashboard', 'E-commerce App', 'Portfolio Site'].map(tag => (
                          <button 
                            key={tag}
                            onClick={() => setInput(`Build a modern ${tag}`)}
                            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'code' ? (
              <div className="w-full h-full flex flex-col font-mono text-[10px] md:text-xs p-6 md:p-8 overflow-y-auto text-white/60 bg-[#080808]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-orange-500/80">
                    <Terminal className="w-4 h-4" />
                    <span className="font-bold tracking-widest uppercase text-[10px]">Source Forge</span>
                  </div>
                  <button 
                    onClick={() => {
                      if (previewCode) {
                        navigator.clipboard.writeText(previewCode);
                      }
                    }}
                    className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
                  >
                    Copy Source
                  </button>
                </div>
                <pre className="leading-relaxed whitespace-pre-wrap break-all">
                  {previewCode || "// No code generated yet."}
                </pre>
              </div>
            ) : (
              <div className="w-full h-full p-6 md:p-8 overflow-y-auto">
                <div className="flex items-center gap-2 mb-6 text-orange-500/80">
                  <Palette className="w-4 h-4" />
                  <span className="font-bold tracking-widest uppercase text-[10px]">Asset Library</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {messages.filter(m => m.imageUrl).map((m, i) => (
                    <div key={i} className="aspect-video rounded-xl overflow-hidden border border-white/10 group relative bg-white/5">
                      <img src={m.imageUrl} className="w-full h-full object-cover" alt="Asset" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a 
                          href={m.imageUrl} 
                          download={`asset-${i}.png`}
                          className="p-2 bg-white/10 rounded-lg backdrop-blur-md text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                  {messages.filter(m => m.imageUrl).length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/20">
                      <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-xs uppercase tracking-widest font-bold">No assets generated yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
      </div>

      {/* Mobile Navigation - Fixed and Persistent */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-white/10 bg-[#0F0F0F]/95 backdrop-blur-3xl flex items-center px-4 gap-2 z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        <button 
          onClick={() => setShowProjectSidebar(true)}
          className="p-2 text-white/20 hover:text-orange-500 transition-all"
        >
          <Layers className="w-5 h-5" />
        </button>
        <div className="w-[1px] h-4 bg-white/10" />
        <button 
          onClick={() => setActiveMobileView('chat')}
          className={cn(
            "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-1",
            activeMobileView === 'chat' ? "text-orange-500" : "text-white/20"
          )}
        >
          <Send className={cn("w-4 h-4 transition-transform duration-300", activeMobileView === 'chat' && "scale-110")} />
          Chat
        </button>
        <div className="w-[1px] h-4 bg-white/10" />
        <button 
          onClick={() => setActiveMobileView('preview')}
          className={cn(
            "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-1",
            activeMobileView === 'preview' ? "text-orange-500" : "text-white/20"
          )}
        >
          <Layout className={cn("w-4 h-4 transition-transform duration-300", activeMobileView === 'preview' && "scale-110")} />
          Preview
        </button>
      </nav>
    </div>
  );
}
