import React, { useState } from 'react';
import { 
  Search, HelpCircle, Book, MessageCircle, 
  Settings, ShoppingCart, Users, ChevronDown, ChevronUp 
} from 'lucide-react';
import styles from './HelpCenter.module.css';

const categories = [
  { icon: ShoppingCart, title: 'POS & Billing', desc: 'Managing orders and payments' },
  { icon: Users, title: 'Customers', desc: 'Loyalty programs and profiles' },
  { icon: Settings, title: 'Configuration', desc: 'Shop settings and services' },
  { icon: Book, title: 'User Guide', desc: 'Full manual for staff' }
];

const initialFaqs = [
  {
    question: 'How do I create a new order?',
    answer: 'Click on the "New Order" button in the sidebar or go to the POS page. Select the services, add customers if needed, and click "Process Payment" to finalize.'
  },
  {
    question: 'How can I settle a credit bill?',
    answer: 'Go to the "Settle Bill" section in the sidebar. Search for the customer or specific bill number, enter the payment amount, and confirm the transaction.'
  },
  {
    question: 'What happens if I go offline?',
    answer: 'Laundry Management System works offline! Your data is saved locally. Once you reconnect to the internet, the sync indicator in the bottom right will turn green and upload your changes.'
  },
  {
    question: 'Can I customize service categories?',
    answer: 'Yes! Navigate to Services > Overview. From there you can manage categories, service types, and add-ons to match your shop requirements.'
  }
];

export default function HelpCenter() {
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  const filteredFaqs = initialFaqs.filter(faq => 
    faq.question.toLowerCase().includes(search.toLowerCase()) ||
    faq.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.helpCenter}>
      <header className={styles.hero}>
        <h1>How can we help?</h1>
        <p>Search our knowledge base or browse categories below to find answers to your questions.</p>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} size={20} />
          <input 
            type="text" 
            placeholder="Search for articles..." 
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <section className={styles.categoriesGrid}>
        {categories.map((cat, idx) => (
          <div key={idx} className={styles.categoryCard}>
            <div className={styles.iconCircle}>
              <cat.icon size={28} />
            </div>
            <h3>{cat.title}</h3>
            <p>{cat.desc}</p>
          </div>
        ))}
      </section>

      <section className={styles.faqSection}>
        <h2>Frequently Asked Questions</h2>
        <div className={styles.faqList}>
          {filteredFaqs.length > 0 ? filteredFaqs.map((faq, idx) => (
            <div key={idx} className={styles.faqItem}>
              <div 
                className={styles.faqQuestion} 
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span>{faq.question}</span>
                {openFaq === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {openFaq === idx && (
                <div className={styles.faqAnswer}>
                  {faq.answer}
                </div>
              )}
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
              No results found for "{search}"
            </div>
          )}
        </div>
      </section>

      <footer className={styles.supportFooter}>
        <MessageCircle size={40} color="#2563EB" />
        <h3>Still need help?</h3>
        <p>Our support team is available 24/7 to assist you with any technical issues.</p>
        <button className={styles.contactBtn}>Contact Support</button>
      </footer>
    </div>
  );
}
