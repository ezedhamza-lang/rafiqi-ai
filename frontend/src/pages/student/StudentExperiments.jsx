import { useState } from 'react';
import { useI18n } from '../../i18n/index.jsx';

const EXPERIMENTS = [
  {
    id: 'exp-1',
    category: 'physics',
    emoji: 'ðŸ’§',
    title: 'Ø§Ù„Ù…Ø§Ø¡ ÙˆÙ‚ÙˆÙ‰ Ø§Ù„Ø¬Ø§Ø°Ø¨ÙŠØ©',
    description: 'Ø§ÙƒØªØ´Ù ÙƒÙŠÙ ÙŠØ³Ù‚Ø· Ø§Ù„Ù…Ø§Ø¡ Ù…Ù† Ù…ÙƒØ§Ù† Ù…Ø±ØªÙØ¹!',
    materials: ['ÙƒÙˆØ¨ Ù…Ø§Ø¡', 'Ù…Ù„Ø¹Ù‚Ø©', 'ÙˆØ±Ù‚Ø©'],
    steps: [
      'Ø§Ù…Ù„Ø£ Ø§Ù„ÙƒÙˆØ¨ Ø¨Ø§Ù„Ù…Ø§Ø¡ Ø­ØªÙ‰ Ø§Ù„Ø­Ø§ÙØ©',
      'Ø¶Ø¹ Ø§Ù„ÙˆØ±Ù‚Ø© ÙÙˆÙ‚ ÙÙ… Ø§Ù„ÙƒÙˆØ¨',
      'Ø§Ù‚Ù„Ø¨ Ø§Ù„ÙƒÙˆØ¨ Ø¨Ø³Ø±Ø¹Ø© Ù…Ø¹ Ø¥Ø¨Ù‚Ø§Ø¡ Ø§Ù„ÙˆØ±Ù‚Ø©',
      'Ø§Ø±ÙØ¹ ÙŠØ¯Ùƒ Ø¹Ù† Ø§Ù„ÙˆØ±Ù‚Ø© Ø¨Ø¨Ø·Ø¡',
      'Ø´Ø§Ù‡Ø¯! Ø§Ù„Ù…Ø§Ø¡ ÙŠØ¨Ù‚Ù‰ ÙÙŠ Ø§Ù„ÙƒÙˆØ¨'
    ],
    question: 'Ù„Ù…Ø§Ø°Ø§ Ø§Ù„Ù…Ø§Ø¡ Ù„Ø§ ÙŠÙ†Ø³ÙƒØ¨ØŸ',
    answer: 'Ø¨Ø³Ø¨Ø¨ Ø¶ØºØ· Ø§Ù„Ù‡ÙˆØ§Ø¡ Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠ Ø¹Ù„Ù‰ Ø§Ù„ÙˆØ±Ù‚Ø©!',
    funFact: 'Ø§Ù„Ù‡ÙˆØ§Ø¡ ÙŠØ¶ØºØ· Ø¨Ù‚ÙˆØ© 10 Ù†ÙŠÙˆØªÙ† Ù„ÙƒÙ„ Ø³Ù…2!'
  },
  {
    id: 'exp-2',
    category: 'physics',
    emoji: 'ðŸŒˆ',
    title: 'Ù‚ÙˆØ³ Ù‚Ø²Ø­ ÙÙŠ Ø§Ù„Ù…Ø§Ø¡',
    description: 'Ø§ØµÙ†Ø¹ Ù‚ÙˆØ³ Ù‚Ø²Ø­ Ø¨Ø³ÙŠØ· ÙÙŠ ØºØ±ÙØ© Ø§Ù„Ø¯Ø±Ø§Ø³Ø©!',
    materials: ['ÙƒÙˆØ¨ Ù…Ø§Ø¡ Ø´ÙØ§Ù', 'Ù…ØµØ¨Ø§Ø­ ÙŠØ¯ÙˆÙŠ', 'Ø­Ø§Ø¦Ø· Ø£Ø¨ÙŠØ¶'],
    steps: [
      'Ø£Ø¶Ø§Ø¡ Ø§Ù„Ù…ØµØ¨Ø§Ø­ Ø¹Ù„Ù‰ Ø¬Ø§Ù†Ø¨ Ø§Ù„ÙƒÙˆØ¨',
      'Ø¶Ø¹ Ø§Ù„ÙƒÙˆØ¨ Ø§Ù„Ù…Ù…ØªÙ„Ø¦ Ø¨Ø§Ù„Ù…Ø§Ø¡ Ø£Ù…Ø§Ù… Ø§Ù„Ø­Ø§Ø¦Ø·',
      'Ø­Ø±Ùƒ Ø§Ù„Ù…ØµØ¨Ø§Ø­ Ø­ÙˆÙ„ Ø§Ù„ÙƒÙˆØ¨',
      'Ø´Ø§Ù‡Ø¯ Ø§Ù„Ø£Ù„ÙˆØ§Ù† Ø¹Ù„Ù‰ Ø§Ù„Ø­Ø§Ø¦Ø·'
    ],
    question: 'Ù„Ù…Ø§Ø°Ø§ Ù†Ø±Ù‰ Ø£Ù„ÙˆØ§Ù†Ø§Ù‹ Ù…Ø®ØªÙ„ÙØ©ØŸ',
    answer: 'Ø§Ù„Ø¶ÙˆØ¡ ÙŠÙ†ÙƒØ³Ø± Ø¹Ù†Ø¯ Ù…Ø±ÙˆØ±Ù‡ Ø¨Ø§Ù„Ù…Ø§Ø¡ ÙˆÙŠÙ†ÙØµÙ„ Ø¹Ù† Ø§Ù„Ø£Ù„ÙˆØ§Ù†!',
    funFact: 'Ø§Ù„Ø£Ø¨ÙŠØ¶ ÙÙŠ Ø§Ù„Ø¶ÙˆØ¡ ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ 7 Ø£Ù„ÙˆØ§Ù†!'
  },
  {
    id: 'exp-3',
    category: 'biology',
    emoji: 'ðŸŒ±',
    title: 'Ù†Ù…Ùˆ Ø§Ù„Ø¨Ø°ÙˆØ±',
    description: 'Ø´Ø§Ù‡Ø¯ ÙƒÙŠÙ ØªÙ†Ù…Ùˆ Ø§Ù„Ø¨Ø°ÙˆØ± ÙÙŠ Ø¨Ø¶Ø¹ Ø£ÙŠØ§Ù…!',
    materials: ['Ø­Ø¨Ø© ÙÙˆÙ„ Ø£Ùˆ Ø¹Ø¯Ø³', 'Ù‚Ø·Ø¹Ø© Ù‚Ø·Ù†', 'ÙƒÙˆØ¨ Ø¨Ù„Ø§Ø³ØªÙŠÙƒÙŠ', 'Ù…Ø§Ø¡'],
    steps: [
      'Ø¶Ø¹ÙŠ Ø§Ù„Ù‚Ø·Ù† ÙÙŠ Ù‚Ø§Ø¹ Ø§Ù„ÙƒÙˆØ¨',
      'Ø±Ø´Ù‘ÙŠ Ø§Ù„Ù‚Ø·Ù† Ø¨Ø§Ù„Ù…Ø§Ø¡ Ø­ØªÙ‰ ÙŠØµØ¨Ø­ Ø±Ø·Ø¨Ø§Ù‹',
      'Ø¶Ø¹ÙŠ Ø­Ø¨Ø© Ø§Ù„ÙÙˆÙ„ Ø¹Ù„Ù‰ Ø§Ù„Ù‚Ø·Ù†',
      'Ø¶Ø¹ÙŠ Ø§Ù„ÙƒÙˆØ¨ ÙÙŠ Ù…ÙƒØ§Ù† Ù…Ø¶Ø§Ø¡ Ø¨Ø§Ù„Ø´Ù…Ø³',
      'Ø§Ø³Ù‚ÙŠ Ø§Ù„Ù‚Ø·Ù† ÙƒÙ„ ÙŠÙˆÙ… ÙˆØ±Ø§Ù‚Ø¨ Ø§Ù„ØªØºÙŠØ±Ø§Øª'
    ],
    question: 'Ù…Ø§Ø°Ø§ ÙŠØ­Ø¯Ø« Ø¨Ø¹Ø¯ 3 Ø£ÙŠØ§Ù…ØŸ',
    answer: 'ØªØ¸Ù‡Ø± Ø¬Ø°ÙŠØ±Ø© ØµØºÙŠØ±Ø© ÙˆØ¨Ø±Ø¹Ù… Ø£Ø®Ø¶Ø±!',
    funFact: 'Ø§Ù„Ø¨Ø°Ø±Ø© ØªØ­ØªØ§Ø¬ Ù…Ø§Ø¡ + Ø¶ÙˆØ¡ + Ù‡ÙˆØ§Ø¡ Ù„ØªÙ†Ù…Ùˆ!'
  },
  {
    id: 'exp-4',
    category: 'biology',
    emoji: 'ðŸ«',
    title: 'ÙƒÙŠÙ Ù†ØªÙ†ÙØ³ØŸ',
    description: 'Ø§ÙƒØªØ´Ù ÙƒÙŠÙ ØªØ¹Ù…Ù„ Ø±Ø¦ØªÙ†Ø§!',
    materials: ['balloon', 'Ø²Ø¬Ø§Ø¬Ø© Ø¨Ù„Ø§Ø³ØªÙŠÙƒÙŠØ© ÙƒØ¨ÙŠØ±Ø©', 'Ø£Ù†Ø¨ÙˆØ¨ Ø±ÙÙŠØ¹'],
    steps: [
      'Ù‚ØµÙ‘ÙŠ Ù‚Ø§Ø¹ Ø§Ù„Ø²Ø¬Ø§Ø¬Ø©',
      'Ø«Ø¨Ù‘ØªÙŠ Ø§Ù„Ø¨Ø§Ù„ÙˆÙ† ÙÙŠ ÙÙ… Ø§Ù„Ø²Ø¬Ø§Ø¬Ø©',
      'Ø§Ø¯Ø®Ù„ÙŠ Ø§Ù„Ø£Ù†Ø¨ÙˆØ¨ Ù…Ù† Ø§Ù„Ø«Ù‚Ø¨',
      'Ø§Ø³Ø­Ø¨ÙŠ Ø§Ù„Ø£Ù†Ø¨ÙˆØ¨ Ù„Ù„Ø®Ø§Ø±Ø¬',
      'Ø³ØªØ±ÙŠÙ† Ø§Ù„Ø¨Ø§Ù„ÙˆÙ† ÙŠØªÙˆØ±Ù…!'
    ],
    question: 'Ù…Ø§Ø°Ø§ ÙŠÙ…Ø«Ù„ Ø§Ù„Ø¨Ø§Ù„ÙˆÙ†ØŸ',
    answer: 'Ø§Ù„Ø¨Ø§Ù„ÙˆÙ† ÙŠÙ…Ø«Ù„ Ø§Ù„Ø±Ø¦Ø© Ø§Ù„ØªÙŠ ØªØªØ³Ø¹ Ø¹Ù†Ø¯ Ø§Ù„ØªÙ†ÙØ³!',
    funFact: 'Ø±Ø¦ØªÙ†Ø§ ØªØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ 300 Ù…Ù„ÙŠÙˆÙ† Ù†ÙØ¶Ø© Ù‡ÙˆØ§Ø¦ÙŠØ©!'
  },
  {
    id: 'exp-5',
    category: 'physics',
    emoji: 'âš¡',
    title: 'Ø§Ù„ÙƒÙ‡Ø±Ø¨Ø§Ø¡ Ù…Ù† Ø§Ù„ balloons',
    description: 'Ø§ØµÙ†Ø¹ Ø´Ø­Ù†Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© Ø¨Ø³ÙŠØ·Ø©!',
    materials: ['balloon', 'Ø´Ø¹Ø± Ø¬Ø§Ù Ø£Ùˆ ØµÙˆÙ', 'Ù‚Ø·Ø¹ ÙˆØ±Ù‚ ØµØºÙŠØ±Ø©'],
    steps: [
      'Ø§ÙØ±ØºÙŠ Ø§Ù„Ø¨Ø§Ù„ÙˆÙ†',
      'Ø§Ø­ÙƒÙ‘ÙŠ Ø§Ù„Ø¨Ø§Ù„ÙˆÙ† Ø¨Ø§Ù„Ø´Ø¹Ø± Ø£Ùˆ Ø§Ù„ØµÙˆÙ Ø¨Ø³Ø±Ø¹Ø©',
      'Ø§Ù‚ØªØ±Ø¨ Ø¨Ø§Ù„Ø¨Ø§Ù„ÙˆÙ† Ù…Ù† Ù‚Ø·Ø¹ Ø§Ù„ÙˆØ±Ù‚',
      'Ø³ØªÙ†Ø¬Ø°Ø¨ Ù‚Ø·Ø¹ Ø§Ù„ÙˆØ±Ù‚ Ø¥Ù„Ù‰ Ø§Ù„Ø¨Ø§Ù„ÙˆÙ†!'
    ],
    question: 'Ù„Ù…Ø§Ø°Ø§ ØªÙ†Ø¬Ø°Ø¨ Ø§Ù„ÙˆØ±Ù‚ØŸ',
    answer: 'Ø§Ù„Ø­Ùƒ ÙŠØ³Ø¨Ø¨ Ø´Ø­Ù†Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© Ø³Ù„Ø¨ÙŠØ© ØªØ¬Ø°Ø¨!',
    funFact: 'Ø§Ù„Ø¨Ø±Ù‚ Ù‡Ùˆ Ø´Ø­Ù†Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© Ø¶Ø®Ù…Ø© Ø¨ÙŠÙ† Ø§Ù„Ø³Ø­Ø¨!'
  },
  {
    id: 'exp-6',
    category: 'chemistry',
    emoji: 'ðŸŒ‹',
    title: 'Ø§Ù„Ø¨Ø±ÙƒØ§Ù† Ø§Ù„ØµØºÙŠØ±',
    description: 'Ø§ØµÙ†Ø¹ Ø¨Ø±ÙƒØ§Ù†Ø§Ù‹ ØµØºÙŠØ±Ø§Ù‹ ÙÙŠ Ø§Ù„Ù…Ø·Ø¨Ø®!',
    materials: ['Ø¨ÙŠÙƒØ±Ø¨ÙˆÙ†Ø§Øª Ø§Ù„ØµÙˆØ¯ÙŠÙˆÙ…', 'Ø®Ù„ Ø£Ø¨ÙŠØ¶', 'ØµØ¨ØºØ© Ø·Ø¹Ø§Ù… Ø­Ù…Ø±Ø§Ø¡', 'ÙƒÙˆØ¨ ÙƒØ¨ÙŠØ±'],
    steps: [
      'Ø¶Ø¹ÙŠ 2 Ù…Ù„Ø¹Ù‚Ø© Ø¨ÙŠÙƒØ±Ø¨ÙˆÙ†Ø§Øª Ø§Ù„ØµÙˆØ¯ÙŠÙˆÙ… ÙÙŠ Ø§Ù„ÙƒÙˆØ¨',
      'Ø£Ø¶Ù Ø¨Ø¶Ø¹ Ù‚Ø·Ø±Ø§Øª Ù…Ù† ØµØ¨ØºØ© Ø§Ù„Ø·Ø¹Ø§Ù…',
      'Ø£Ø¶Ù Ù†ØµÙ ÙƒÙˆØ¨ Ù…Ù† Ø§Ù„Ø®Ù„ Ø¨Ø¨Ø·Ø¡',
      'Ø´Ø§Ù‡Ø¯ Ø§Ù„Ø¨Ø±ÙƒØ§Ù† ÙŠÙ†ÙØ¬Ø±!'
    ],
    question: 'Ù„Ù…Ø§Ø°Ø§ ÙŠÙ†ØªÙØ® Ø§Ù„Ø¨Ø±ÙƒØ§Ù†ØŸ',
    answer: 'ØªÙØ§Ø¹Ù„ Ø§Ù„Ø¨ÙƒØ±Ø¨ÙˆÙ†Ø§Øª Ù…Ø¹ Ø§Ù„Ø®Ù„ ÙŠÙ†ØªØ¬ ØºØ§Ø² Ø«Ø§Ù†ÙŠ Ø£ÙƒØ³Ø¯ Ø§Ù„ÙƒØ±Ø¨ÙˆÙ†!',
    funFact: 'Ø§Ù„Ø¨Ø±Ø§ÙƒÙŠÙ† Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠØ© ØªÙ†ÙØ« Ø§Ù„ØµÙ‡Ø§Ø±Ø© Ø§Ù„Ø³Ø§Ø®Ù†Ø©!'
  },
  {
    id: 'exp-7',
    category: 'physics',
    emoji: 'ðŸ§²',
    title: 'Ù‚ÙˆØ© Ø§Ù„Ù…ØºÙ†Ø§Ø·ÙŠØ³',
    description: 'Ø§ÙƒØªØ´Ù Ù‚ÙˆØ© Ø§Ù„Ø¬Ø§Ø°Ø¨ÙŠØ© Ø§Ù„Ù…ØºÙ†Ø§Ø·ÙŠØ³ÙŠØ©!',
    materials: ['Ù…ØºÙ†Ø§Ø·ÙŠØ³ Ù‚ÙˆÙŠ', 'Ù…Ø³Ø§Ù…ÙŠØ± Ø­Ø¯ÙŠØ¯ÙŠØ©', 'ÙˆØ±Ù‚Ø©', 'Ø²Ø¬Ø§Ø¬'],
    steps: [
      'Ø¶Ø¹ Ø§Ù„Ù…Ø³Ø§Ù…ÙŠØ± Ø¹Ù„Ù‰ Ø§Ù„ÙˆØ±Ù‚Ø© ÙÙˆÙ‚ Ø§Ù„Ø²Ø¬Ø§Ø¬',
      'Ø£Ø­Ø¶Ø± Ø§Ù„Ù…ØºÙ†Ø§Ø·ÙŠØ³ Ù…Ù† ØªØ­Øª Ø§Ù„Ø²Ø¬Ø§Ø¬',
      'Ø§Ø³Ø­Ø¨ Ø§Ù„Ù…Ø³Ø§Ù…ÙŠØ± Ø¨Ø¨Ø·Ø¡',
      'Ø¬Ø±Ù‘Ø¨ Ø±ÙØ¹ Ø§Ù„Ù…ØºÙ†Ø§Ø·ÙŠØ³ â€” Ø³ØªØ±Ù‰ Ø§Ù„Ù…Ø³Ø§Ù…ÙŠØ± ØªØªØ¨Ø¹Ù‡!'
    ],
    question: 'Ù„Ù…Ø§Ø°Ø§ ØªØªØ¨Ø¹ Ø§Ù„Ù…Ø³Ø§Ù…ÙŠØ± Ø§Ù„Ù…ØºÙ†Ø§Ø·ÙŠØ³ØŸ',
    answer: 'Ø§Ù„Ù…ØºÙ†Ø§Ø·ÙŠØ³ ÙŠÙØµØ¯Ø± Ø­Ù‚Ù„ Ù…ØºÙ†Ø§Ø·ÙŠØ³ÙŠ ÙŠØ¬Ø°Ø¨ Ø§Ù„Ù…Ø¹Ø§Ø¯Ù† Ø§Ù„Ø­Ø¯ÙŠØ¯ÙŠØ©!',
    funFact: 'Ø§Ù„Ø£Ø±Ø¶ Ù†ÙØ³Ù‡Ø§ Ù…ØºÙ†Ø§Ø·ÙŠØ³ Ø¶Ø®Ù…!'
  },
  {
    id: 'exp-8',
    category: 'chemistry',
    emoji: 'ðŸ§ª',
    title: 'Ø§Ù„Ù…Ø§Ø¡ Ø§Ù„Ù…ØªÙ„ÙˆÙ†',
    description: 'Ø§ØµÙ†Ø¹ Ù…Ø§Ø¡Ù‹ Ù…ØªØ¹Ø¯Ø¯ Ø§Ù„Ø£Ù„ÙˆØ§Ù†!',
    materials: ['3 Ø£ÙƒÙˆØ§Ø¨ Ù…Ø§Ø¡', 'ØµØ¨ØºØ§Øª Ø·Ø¹Ø§Ù… (Ø£Ø­Ù…Ø±ØŒ Ø£Ø²Ø±Ù‚ØŒ Ø£ØµÙØ±)', 'Ù…Ù…ØµÙ‘ (dropper)'],
    steps: [
      'ØµØ¨Ù‘ ØµØ¨ØºØ© Ø­Ù…Ø±Ø§Ø¡ ÙÙŠ ÙƒÙˆØ¨ Ù…Ø§Ø¡',
      'ØµØ¨Ù‘ ØµØ¨ØºØ© Ø²Ø±Ù‚Ø§Ø¡ ÙÙŠ ÙƒÙˆØ¨ Ø¢Ø®Ø±',
      'ØµØ¨Ù‘ ØµØ¨ØºØ© ØµÙØ±Ø§Ø¡ ÙÙŠ Ø§Ù„ÙƒÙˆØ¨ Ø§Ù„Ø«Ø§Ù„Ø«',
      'Ø§Ù…Ø²Ø¬ Ø§Ù„Ø£Ù„ÙˆØ§Ù† Ø¨Ø¨Ø¹Ø¶Ù‡Ø§ Ø¨Ù‚Ø·Ø±Ø§Øª ØµØºÙŠØ±Ø©',
      'Ø±Ø§Ù‚Ø¨ Ø§Ù„Ø£Ù„ÙˆØ§Ù† Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©!'
    ],
    question: 'Ù…Ø§Ø°Ø§ ØªØ­ØµÙ„ Ø¹Ù†Ø¯ Ù…Ø²Ø¬ Ø§Ù„Ø£Ø²Ø±Ù‚ ÙˆØ§Ù„Ø£ØµÙØ±ØŸ',
    answer: 'ØªØ­ØµÙ„ Ø¹Ù„Ù‰ Ø§Ù„Ù„ÙˆÙ† Ø§Ù„Ø£Ø®Ø¶Ø±!',
    funFact: 'Ø§Ù„Ù„ÙˆÙ† Ø§Ù„Ø£Ø®Ø¶Ø± Ù‡Ùˆ Ø§Ù„Ù…Ø²ÙŠØ¬ Ø¨ÙŠÙ† Ø§Ù„Ø£Ø²Ø±Ù‚ ÙˆØ§Ù„Ø£ØµÙØ±!'
  }
];

const CATEGORIES = [
  { id: 'all', emoji: 'ðŸ”¬', label: 'Ø§Ù„ÙƒÙ„' },
  { id: 'physics', emoji: 'âš¡', label: 'Ø§Ù„ÙÙŠØ²ÙŠØ§Ø¡' },
  { id: 'biology', emoji: 'ðŸ§¬', label: 'Ø§Ù„Ø£Ø­ÙŠØ§Ø¡' },
  { id: 'chemistry', emoji: 'ðŸ§ª', label: 'Ø§Ù„ÙƒÙŠÙ…ÙŠØ§Ø¡' }
];

function ExperimentCard({ exp, onClick }) {
  const catColor = exp.category === 'physics' ? '#3b82f6' : exp.category === 'biology' ? '#10b981' : '#E8A317';
  return (
    <div className="exp-card" onClick={() => onClick(exp)} style={{ borderTop: `4px solid ${catColor}` }}>
      <div className="exp-card__emoji">{exp.emoji}</div>
      <div className="exp-card__body">
        <h4 className="exp-card__title">{exp.title}</h4>
        <p className="exp-card__desc">{exp.description}</p>
        <span className="exp-card__cat" style={{ color: catColor }}>
          {exp.category === 'physics' ? 'ÙÙŠØ²ÙŠØ§Ø¡' : exp.category === 'biology' ? 'Ø£Ø­ÙŠØ§Ø¡' : 'ÙƒÙŠÙ…ÙŠØ§Ø¡'}
        </span>
      </div>
    </div>
  );
}

function ExperimentDetail({ exp, onBack }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const catColor = exp.category === 'physics' ? '#3b82f6' : exp.category === 'biology' ? '#10b981' : '#E8A317';
  return (
    <div className="exp-detail">
      <button className="exp-back" onClick={onBack}>
        <span className="material-icons">arrow_back</span>
      </button>

      <div className="exp-detail__hero" style={{ background: `linear-gradient(135deg, ${catColor}, ${catColor}88)` }}>
        <span className="exp-detail__emoji">{exp.emoji}</span>
        <h2 className="exp-detail__title">{exp.title}</h2>
      </div>

      <div className="exp-detail__body">
        <div className="exp-step-section">
          <h3 className="exp-step-section__title">
            <span className="material-icons" style={{ color: catColor }}>inventory_2</span>
            Ø§Ù„Ø£Ø¯ÙˆØ§Øª Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©
          </h3>
          <ul className="exp-materials">
            {exp.materials.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>

        <div className="exp-step-section">
          <h3 className="exp-step-section__title">
            <span className="material-icons" style={{ color: catColor }}>format_list_numbered</span>
            Ø®Ø·ÙˆØ§Øª Ø§Ù„ØªØ¬Ø±Ø¨Ø©
          </h3>
          <ol className="exp-steps">
            {exp.steps.map((s, i) => (
              <li key={i} className="exp-step">
                <span className="exp-step__num">{i + 1}</span>
                <span className="exp-step__text">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="exp-question-box">
          <h4 className="exp-question-box__title">
            <span className="material-icons">help</span>
            Ø³Ø¤Ø§Ù„ Ø§Ù„ØªØ¬Ø±Ø¨Ø©
          </h4>
          <p className="exp-question-box__q">{exp.question}</p>
          {!showAnswer ? (
            <button className="exp-question-box__btn" onClick={() => setShowAnswer(true)}>
              Ø£Ø¸Ù‡Ø± Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø©
            </button>
          ) : (
            <div className="exp-question-box__answer">
              <span className="material-icons" style={{ color: '#10b981' }}>check_circle</span>
              <span>{exp.answer}</span>
            </div>
          )}
        </div>

        <div className="exp-fun-fact">
          <span className="exp-fun-fact__icon">ðŸ’¡</span>
          <p className="exp-fun-fact__text">{exp.funFact}</p>
        </div>
      </div>
    </div>
  );
}

export default function StudentExperiments() {
  const { t } = useI18n();
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  const filtered = category === 'all' ? EXPERIMENTS : EXPERIMENTS.filter(e => e.category === category);

  if (selected) {
    return <ExperimentDetail exp={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="student-experiments">
      <div className="exp-header" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}>
        <span className="material-icons exp-header__icon">science</span>
        <div>
          <h2 className="exp-header__title">{t('studentSpace.experiments.title')}</h2>
          <p className="exp-header__sub">{t('studentSpace.experiments.subtitle')}</p>
        </div>
      </div>

      <div className="exp-categories">
        {CATEGORIES.map(c => (
          <button key={c.id}
            className={`exp-cat-btn ${category === c.id ? 'exp-cat-btn--active' : ''}`}
            onClick={() => setCategory(c.id)}>
            <span>{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="exp-grid">
        {filtered.map(exp => (
          <ExperimentCard key={exp.id} exp={exp} onClick={setSelected} />
        ))}
      </div>
    </div>
  );
}
