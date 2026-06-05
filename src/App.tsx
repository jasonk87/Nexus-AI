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
  X,
  Menu,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '@/src/lib/utils';


interface Message {
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'ui-plan' | 'image-gen' | 'image-input' | 'error';
  imageUrl?: string;
  errorDetails?: string;
  buildVersion?: number;
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  
  const [apiKey, setApiKey] = useState(() => process.env.GEMINI_API_KEY || localStorage.getItem('nexus_api_key') || '');
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('nexus_ollama_url') || 'http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState<{provider: 'google' | 'ollama', id: string}>(() => {
    const saved = localStorage.getItem('nexus_model');
    return saved ? { ...JSON.parse(saved), provider: 'google', id: 'gemini-2.5-flash-lite' } : {provider: 'google', id: 'gemini-2.5-flash-lite'};
  });
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const ai = React.useMemo(() => new GoogleGenAI({ apiKey }), [apiKey]);

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

  useEffect(() => {
    localStorage.setItem('nexus_api_key', apiKey);
    localStorage.setItem('nexus_ollama_url', ollamaUrl);
    localStorage.setItem('nexus_model', JSON.stringify(selectedModel));
  }, [apiKey, ollamaUrl, selectedModel]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEXUS_ERROR') {
        const errorText = event.data.message;
        
        setProjects(prev => prev.map(p => {
          if (p.id === activeProjectId) {
            const lastMsg = p.messages[p.messages.length - 1];
            if (lastMsg && lastMsg.type === 'error' && lastMsg.errorDetails === errorText) {
              return p; // Prevent spam
            }
            return {
              ...p,
              messages: [...p.messages, {
                role: 'assistant',
                content: "⚠️ **Runtime error detected in prototype window.**",
                type: 'error',
                errorDetails: errorText
              }]
            };
          }
          return p;
        }));
        
        setActiveMobileView('chat');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeProjectId]);

  useEffect(() => {
    fetchOllamaModels();
  }, [ollamaUrl]);

  const fetchOllamaModels = async () => {
    setIsFetchingModels(true);
    try {
      const res = await fetch("/api/proxy/ollama/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ollamaUrl })
      });
      const data = await res.json();
      setOllamaModels(data.models?.map((m: any) => m.name) || []);
    } catch (e) {
      console.error("Failed to fetch Ollama models:", e);
      setOllamaModels([]);
    } finally {
      setIsFetchingModels(false);
    }
  };

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

  const handleSend = async (overrideInput?: string | React.MouseEvent) => {
    const isOverride = typeof overrideInput === 'string';
    const textToSend = isOverride ? (overrideInput as string) : input;

    if ((!textToSend.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: textToSend, 
      type: (selectedImage && !isOverride) ? 'image-input' : 'text',
      imageUrl: (selectedImage && !isOverride) ? selectedImage : undefined
    };
    
    // Update local messages immediately for UX
    let updatedMessages = [...messages, userMessage];

    if (!isOverride) {
      setInput('');
      setSelectedImage(null);
    }
    
    // If no active project, create one
    let currentProjectId = activeProjectId;
    if (!currentProjectId) {
      const newId = Math.random().toString(36).substring(7);
      const newProject: Project = {
        id: newId,
        name: 'Analyzing...',
        description: textToSend || 'Image Analysis',
        messages: updatedMessages,
        versions: [],
        currentVersionIndex: -1,
        createdAt: Date.now()
      };
      setProjects(prev => [newProject, ...prev]);
      setActiveProjectId(newId);
      currentProjectId = newId;

      // Generate a creative name in the background
      const promptText = `As the Nexus Master Architect, generate a professional, high-end, and commercially viable brand name for an application based on this prompt: "${textToSend || 'Visual Analysis'}". Return ONLY the name, no quotes or extra text.`;
      
      const titlePromise = selectedModel.provider === 'google' 
        ? ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{ role: 'user', parts: [{ text: promptText }] }]
          }).then(res => res.text?.trim() || 'New Prototype')
        : fetch("/api/proxy/ollama/generate", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: ollamaUrl, payload: { model: selectedModel.id, prompt: promptText, stream: false } })
          }).then(res => res.json()).then(data => data.response?.trim() || 'New Prototype');
      
      titlePromise.then(generatedName => {
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
      const isBuildRequest = buildKeywords.some(k => textToSend.toLowerCase().includes(k)) || textToSend.length > 50 || currentImage;

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
        // 1. Generate Text Response/Plan
        // We map and consolidate consecutive roles to ensure strict alternation for Gemini API
        const contents = updatedMessages.reduce<any[]>((acc, m) => {
          const role = m.role === 'user' ? 'user' : 'model';
          const parts: any[] = [{ text: m.content || (m.type === 'image-input' ? "Analyze this image." : "") }];
          
          if (m.imageUrl && m.role === 'user' && m.type === 'image-input') {
            parts.push({
              inlineData: { data: m.imageUrl.split(',')[1], mimeType: "image/png" }
            });
          }

          if (acc.length > 0 && acc[acc.length - 1].role === role) {
            // Append to the previous message of the same role
            acc[acc.length - 1].parts.push({ text: "\n\n" });
            acc[acc.length - 1].parts.push(...parts);
          } else {
            acc.push({ role, parts });
          }
          return acc;
        }, []);

        // Gemini typically expects the conversation to start with a 'user' role
        if (contents.length > 0 && contents[0].role === 'model') {
          contents.shift();
        }

        let systemInstruction = `You are the Nexus Master Architect, an elite Principal Engineer at a top-tier tech firm. Your core mission is to build high-fidelity, production-grade applications that push the boundaries of modern web development.

            PHILOSOPHY:
            1. DIFFUSION BUILDING: You build logic, state, and UI in parallel, stitching them into a unified, seamless experience.
            2. ENGINEERING EXCELLENCE: 
               - NEVER fake logic. No "dummy" implementations, no mocks, no \`Math.random()\` placeholders for real AI/ML.
               - If the user asks for Machine Learning, implement real algorithms (Neural Networks, Q-Learning, Neuroevolution) or use real libraries like ml5.js.
               - Write modular, optimized, and professional-grade code (ES6+).
               - Use advanced data structures (Trees, Graphs, Buffers) where appropriate for performance.
            3. DESIGN LEADERSHIP:
               - The UI must be "Ultra-High-End, Modern, and Professional"—think Apple-tier polish.
               - Beyond basic Tailwind: Use complex CSS Grid/Flex combinations, custom cubic-bezier motion curves, and sophisticated micro-interactions.
               - All interactive elements must have hover, focus, and active states.

            ALLOWED LIBS (CDN):
               - Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
               - Lucide Icons: <script src="https://unpkg.com/lucide@latest"></script>
               - p5.js (Visuals/Games): <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.6.0/p5.min.js"></script>
               - Three.js (3D): <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.150.1/three.min.js"></script>
               - Matter.js (Physics): <script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>
               - ml5.js (Machine Learning): <script src="https://unpkg.com/ml5@latest/dist/ml5.min.js"></script>
               - Chart.js (Data): <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
               
            EXPLICIT BANS:
               - NO PLACEHOLDERS: Everything must be 100% functional.
               - NO NATIVE DIALOGS: Never use \`alert()\`, \`prompt()\`, or \`confirm()\`. Build custom modals.
            
            NEXUS BUILD LOG: Provide a deep technical log using Markdown headers:
                ### 🛠️ NEXUS ARCHITECT LOG
                - **Engineering Logic**: [Deep dive into algorithmic implementations]
                - **Architecture Pattern**: [State management, system design]
                - **UX Strategy**: [Aesthetic choice rationale]
            
            UI Constraint: Full viewport. Use \`min-h-screen\` or \`h-screen\`.`;

        if (previewCode) {
          const lastMessage = contents[contents.length - 1];
          if (lastMessage && lastMessage.role === 'user') {
            const textPart = lastMessage.parts.find(p => p.text);
            if (textPart) {
              const userOriginalRequest = textPart.text;
              textPart.text = `CONTEXT - CURRENT PROTOTYPE CODE:\n\`\`\`html\n${previewCode}\n\`\`\`\n\nUSER REQUEST: ${userOriginalRequest}\n\n(Remember to use strict <<<< ==== >>>> diff blocks to answer the user request based on the context above!)`;
            }
          }
          systemInstruction += `\n\n
            ITERATION MODE (SEARCH AND REPLACE):
            The user already has a working prototype. DO NOT output the full file.
            Instead, use strict Search and Replace diff blocks to modify the existing code.
            
            FORMAT:
            <<<<
            Exact lines to find and replace from the existing requested code (must match indentation and whitespace perfectly)
            ====
            New lines of code to inject in its place
            >>>>
            
            EXAMPLES:
            
            Example 1 (Single Edit):
            <<<<
            <button class="bg-blue-500">Submit</button>
            ====
            <button class="bg-red-500 font-bold">Delete</button>
            >>>>
            
            Example 2 (Multiple Edits at Once - Just use multiple blocks):
            <<<<
            let score = 0;
            ====
            let score = 0;
            let level = 1;
            >>>>
            
            <<<<
            function win() {
                console.log("Win");
            }
            ====
            function win() {
                console.log("Win - Level " + level);
                score += 100;
            }
            >>>>
            
            CRITICAL RULES:
            - You can output as many of these blocks as needed to update the logic and UI simultaneously.
            - Do NOT output the full file inside \`\`\`html\`\`\`. Only output diff blocks.
            - NEVER FORGET to close the block with \`>>>>\`.
          `;
        } else {
          systemInstruction += `\n\n
            CRITICAL DIRECTIVES FOR NEW BUILD:
            1. Output EXACTLY ONE block of code wrapped in \`\`\`html ... \`\`\`.
            2. The code MUST be a complete, self-contained, and functional production-grade miracle.
          `;
        }

        let rawContent = "";
        
        if (selectedModel.provider === 'google') {
          const textResponse = await ai.models.generateContent({
            model: selectedModel.id,
            contents,
            config: { systemInstruction }
          });
          rawContent = textResponse.text || "";
        } else {
          // Ollama fallback
          const ollamaMessages = [];
          ollamaMessages.push({ role: 'system', content: systemInstruction });
          for (const c of contents) {
            const role = c.role === 'model' ? 'assistant' : 'user';
            let text = "";
            let images: string[] = [];
            for (const part of c.parts) {
              if (part.text) text += part.text;
              if (part.inlineData) images.push(part.inlineData.data);
            }
            ollamaMessages.push({ role, content: text, images: images.length > 0 ? images : undefined });
          }

          const res = await fetch("/api/proxy/ollama/chat", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: ollamaUrl, payload: { model: selectedModel.id, messages: ollamaMessages, stream: false } })
          });
          const data = await res.json();
          rawContent = data.message?.content || "";
        }

        clearInterval(diffusionInterval);
        setBuildProgress(prev => prev ? { ...prev, step: 'Build Complete', percent: 100 } : null);
        
        setTimeout(() => {
          setIsBuilding(false);
          setBuildProgress(null);
        }, 1000);
        let displayContent = rawContent;
        let newCode = previewCode;
        let hasNewCode = false;

        const normalizeNewlines = (str: string) => str.replace(/\r\n/g, '\n');
        let newCodeNormalized = normalizeNewlines(newCode || "");
        
        const diffRegex = /<<<<[\r\n]*([\s\S]*?)[\r\n]*====[\r\n]*([\s\S]*?)[\r\n]*>>>>/g;
        let match;
        let diffsApplied = 0;
        
        while ((match = diffRegex.exec(rawContent)) !== null) {
            const targetContent = normalizeNewlines(match[1]);
            const replacementContent = match[2]; // Keep original format for insertion
            
            if (newCodeNormalized.includes(targetContent)) {
               newCodeNormalized = newCodeNormalized.replace(targetContent, replacementContent);
               diffsApplied++;
            } else {
               console.warn("Nexus Diff Engine: Could not find target chunk to replace.");
               const fallbackTarget = targetContent.trim();
               if (fallbackTarget.length > 10 && newCodeNormalized.includes(fallbackTarget)) {
                  newCodeNormalized = newCodeNormalized.replace(fallbackTarget, replacementContent);
                  diffsApplied++;
               }
            }
        }

        if (diffsApplied > 0) {
            hasNewCode = true;
            newCode = newCodeNormalized;
            displayContent = rawContent.replace(/<<<<[\r\n]*[\s\S]*?[\r\n]*====[\r\n]*[\s\S]*?[\r\n]*>>>>/g, '').trim();
        } else {
            let codeMatch = rawContent.match(/```(?:html|jsx|tsx|javascript|typescript|vue|svelte)?\n([\s\S]*?)```/i);
            
            if (codeMatch) {
              newCode = codeMatch[1];
              displayContent = rawContent.replace(/```(?:html|jsx|tsx|javascript|typescript|vue|svelte)?\n[\s\S]*?```/i, '').trim();
              hasNewCode = true;
            } else {
              // Fallback heuristic: Sometimes LLMs ignore backticks and raw dump HTML
              const lowerContent = rawContent.toLowerCase();
              const htmlStart = lowerContent.indexOf('<!doctype html>');
              const htmlAltStart = lowerContent.indexOf('<html');
              const startIndex = htmlStart !== -1 ? htmlStart : htmlAltStart;
              
              if (startIndex !== -1) {
                const endMatch = lowerContent.lastIndexOf('</html>');
                if (endMatch !== -1) {
                  const endIndex = endMatch + 7; // Length of </html>
                  newCode = rawContent.substring(startIndex, endIndex);
                  displayContent = rawContent.substring(0, startIndex) + '\n' + rawContent.substring(endIndex);
                  displayContent = displayContent.trim();
                  hasNewCode = true;
                }
              }
            }
        }

        // Final safety scrub to make sure ANY remaining massive raw code blocks or style tags are stripped from UI chat
        displayContent = displayContent.replace(/<style[\s\S]*?<\/style>/gi, '')
                                       .replace(/<script[\s\S]*?<\/script>/gi, '')
                                       .replace(/<body[\s\S]*?<\/body>/gi, '')
                                       .trim();

        if (!displayContent) {
          displayContent = "I've successfully diffused the prototype update. You can view the live build and source code in the preview panel.";
        }

        setProjects(prev => prev.map(p => {
          if (p.id === currentProjectId) {
            const newVersions = hasNewCode ? [...p.versions, newCode!] : p.versions;
            
            const finalAssistantMessage: Message = {
              role: 'assistant',
              content: displayContent,
              type: 'ui-plan',
              buildVersion: hasNewCode ? newVersions.length - 1 : undefined
            };

            return {
              ...p,
              messages: [...updatedMessages, finalAssistantMessage],
              versions: newVersions,
              currentVersionIndex: newVersions.length - 1,
            };
          }
          return p;
        }));

      } else {
        // Just a regular question
        const systemInstruction = "You are the Nexus Master Architect, an elite Principal Engineer. Answer the user's question with technical depth, absolute precision, and the authority of a world-class system designer.";
        let assistantText = "";

        if (selectedModel.provider === 'google') {
          const textResponse = await ai.models.generateContent({
            model: selectedModel.id,
            contents: updatedMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
            config: { systemInstruction },
          });
          assistantText = textResponse.text || "I'm processing your request...";
        } else {
          const ollamaMessages = [{ role: 'system', content: systemInstruction }, ...updatedMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))];
          const res = await fetch("/api/proxy/ollama/chat", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: ollamaUrl, payload: { model: selectedModel.id, messages: ollamaMessages, stream: false } })
          });
          const data = await res.json();
          assistantText = data.message?.content || "I'm processing your request...";
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: assistantText,
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

  const requestRollback = () => {
    if (!activeProject || activeProject.currentVersionIndex === activeProject.versions.length - 1) return;
    setShowRollbackConfirm(true);
  };

  const executeRollback = () => {
    if (!activeProject) return;
    
    const targetVersion = activeProject.currentVersionIndex;
    
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      
      const newVersions = p.versions.slice(0, targetVersion + 1);
      
      let truncateAtMessageIndex = p.messages.length;
      let versionCounter = -1;
      
      for (let i = 0; i < p.messages.length; i++) {
        const msg = p.messages[i];
        
        if (msg.buildVersion !== undefined) {
           versionCounter = msg.buildVersion;
        } else if (msg.type === 'ui-plan') {
           // Fallback for older projects that didn't have buildVersion tagged
           versionCounter++; 
        }
        
        if (versionCounter > targetVersion) {
            truncateAtMessageIndex = i;
            if (i > 0 && p.messages[i-1].role === 'user') {
                truncateAtMessageIndex = i - 1;
            }
            break;
        }
      }
      
      return {
        ...p,
        versions: newVersions,
        messages: p.messages.slice(0, truncateAtMessageIndex)
      };
    }));
    setShowRollbackConfirm(false);
  };

  return (
    <div className="flex h-[100dvh] bg-[#0A0A0A] text-[#F5F5F4] font-sans selection:bg-orange-500/30 overflow-hidden relative">
      {/* Project Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-[#050505] border-r border-white/10 z-[60] transition-transform duration-300",
        showProjectSidebar ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-500" />
              <span className="font-black uppercase tracking-tighter italic">Prototypes</span>
            </div>
            <button 
              onClick={() => setShowProjectSidebar(false)}
              className="p-2 text-white/40 hover:text-white transition-all cursor-pointer"
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

      {/* Overlay for project sidebar */}
      {showProjectSidebar && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50]"
          onClick={() => setShowProjectSidebar(false)}
        />
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative h-full">
        {/* Sidebar - Chat Interface */}
        <aside className={cn(
          "w-full md:w-[450px] lg:w-[500px] border-r border-white/10 flex flex-col bg-[#0F0F0F] relative z-10 shadow-2xl transition-all duration-300 h-full overflow-hidden",
          activeMobileView === 'chat' ? "flex" : "hidden md:flex"
        )}>
        <header className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowProjectSidebar(true)}
              className="p-2 -ml-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all font-bold group"
              title="Menu"
            >
              <Menu className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Nexus AI</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest border border-orange-500/30 px-2 py-0.5 rounded-full bg-orange-500/10 shadow-[0_0_10px_rgba(234,88,12,0.1)]">Responsive Optimized</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live Build
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 hover:rotate-90 transition-transform duration-300" />
            </button>
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
                  
                  {msg.type === 'error' && msg.errorDetails && (
                    <button
                      onClick={() => handleSend(`Fix the following runtime error:\n\n${msg.errorDetails}`)}
                      className="mt-3 px-4 py-2 bg-red-600/20 border border-red-500/50 rounded-xl text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-600/30 transition-all flex items-center gap-2"
                    >
                      <Zap className="w-3 h-3" /> Fix Error
                    </button>
                  )}
                  
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
            Engine: <span className="text-orange-500 font-bold uppercase tracking-widest">{selectedModel.provider === 'ollama' ? 'Local ' : ''}{selectedModel.id}</span>
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
                  className="p-1.5 rounded-lg text-white/40 hover:text-white disabled:opacity-20 transition-colors"
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
                  className="p-1.5 rounded-lg text-white/40 hover:text-white disabled:opacity-20 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {activeProject.currentVersionIndex < activeProject.versions.length - 1 && (
                  <>
                    <div className="w-[1px] h-4 bg-white/10 mx-1" />
                    <button
                      onClick={requestRollback}
                      className="group px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/50 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0)] hover:shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                      title="Rollback to this version"
                    >
                      <Zap className="w-3 h-3 group-hover:scale-110 transition-transform" />
                      Rollback Here
                    </button>
                  </>
                )}
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
              viewMode === 'desktop' ? "w-full h-full" : "w-[320px] h-[568px] md:w-[375px] md:h-[667px]"
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
                              <script>
                                window.onerror = function(msg, source, line, col, error) {
                                  if (window.parent) {
                                    window.parent.postMessage({ type: 'NEXUS_ERROR', message: msg + ' at line ' + line }, '*');
                                  }
                                };
                                window.onunhandledrejection = function(event) {
                                  if (window.parent) {
                                    window.parent.postMessage({ type: 'NEXUS_ERROR', message: 'Unhandled Rejection: ' + (event.reason ? event.reason.toString() : 'Unknown Error') }, '*');
                                  }
                                };
                              </script>
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

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">System Configuration</h2>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Model & API Setup</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto w-full">
                {/* Active Model Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-white/90">Active Model</label>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Engine</span>
                  </div>
                  <select 
                    value={`${selectedModel.provider}:${selectedModel.id}`}
                    onChange={(e) => {
                      const parts = e.target.value.split(':');
                      if (parts.length >= 2) {
                        const provider = parts[0] as 'google'|'ollama';
                        const id = parts.slice(1).join(':');
                        setSelectedModel({ provider, id });
                      }
                    }}
                    className="w-full bg-[#111] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-orange-500/50 appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                  >
                    <optgroup label="Google GenAI (Remote)">
                      <option value="google:gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                      <option value="google:gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview)</option>
                      <option value="google:gemini-3-flash-preview">Gemini 3 Flash (Preview)</option>
                      <option value="google:gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
                      <option value="google:gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                      <option value="google:gemini-2.0-flash">Gemini 2.0 Flash (Stable)</option>
                      <option value="google:gemini-2.0-flash-thinking-exp-01-21">Gemini 2.0 Flash Thinking (Exp)</option>
                      <option value="google:gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro Exp (02-05)</option>
                      <option value="google:gemini-1.5-pro">Gemini 1.5 Pro (Latest)</option>
                      <option value="google:gemini-1.5-pro-002">Gemini 1.5 Pro (002)</option>
                      <option value="google:gemini-1.5-flash">Gemini 1.5 Flash (Latest)</option>
                      <option value="google:gemini-1.5-flash-002">Gemini 1.5 Flash (002)</option>
                      <option value="google:gemini-1.5-flash-8b">Gemini 1.5 Flash-8B</option>
                      <option value="google:gemini-1.0-pro">Gemini 1.0 Pro (Legacy)</option>
                    </optgroup>
                    <optgroup label="Ollama (Local)">
                      {ollamaModels.length === 0 ? (
                        <option disabled>No local models available.</option>
                      ) : (
                        ollamaModels.map(name => (
                          <option key={name} value={`ollama:${name}`}>{name}</option>
                        ))
                      )}
                    </optgroup>
                  </select>
                </div>

                <hr className="border-white/5" />

                {/* Google Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-white/90">Google GenAI Configuration</label>
                  </div>
                  <div className="space-y-2 relative">
                    <span className="absolute top-1/2 -translate-y-1/2 left-4">
                      <Sparkles className="w-4 h-4 text-orange-500/80" />
                    </span>
                    <input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter Gemini API Key..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 pl-11 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                    />
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Ollama Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-white/90">Ollama Configuration</label>
                    <button 
                      onClick={fetchOllamaModels}
                      disabled={isFetchingModels}
                      className="text-[10px] font-bold uppercase tracking-widest text-orange-500 hover:text-orange-400 disabled:opacity-50 transition-colors"
                    >
                      {isFetchingModels ? "Refreshing..." : "Refresh Models"}
                    </button>
                  </div>
                  <div className="space-y-2 relative">
                    <span className="absolute top-1/2 -translate-y-1/2 left-4">
                      <Terminal className="w-4 h-4 text-orange-500/80" />
                    </span>
                    <input 
                      type="text" 
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 pl-11 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rollback Confirmation Modal */}
      <AnimatePresence>
        {showRollbackConfirm && activeProject && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRollbackConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0A0A0A] border border-red-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-red-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <Zap className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">System Rollback</h2>
                    <p className="text-[10px] text-red-500 uppercase tracking-widest font-bold animate-pulse">Critical Operation</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <p className="text-sm text-white/80 leading-relaxed">
                  You are about to irreversibly rollback this prototype to <span className="font-bold text-white px-2 py-0.5 bg-white/10 rounded-md">V{activeProject.currentVersionIndex + 1}</span>.
                </p>
                
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] rounded-full pointer-events-none" />
                  <p className="text-xs text-red-200 leading-relaxed font-medium relative z-10">
                    This will <strong className="text-red-500 uppercase tracking-wider">permanently delete</strong> all subsequent code versions and wipe the AI's chat memory of those downstream interactions.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-white-[0.02] flex items-center gap-3 justify-end shrink-0">
                <button
                  onClick={() => setShowRollbackConfirm(false)}
                  className="px-6 py-3 rounded-xl text-sm font-bold tracking-wide text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={executeRollback}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] flex items-center gap-2 group"
                >
                  <Zap className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  Execute Rollback
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
