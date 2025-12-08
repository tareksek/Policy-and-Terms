
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Zap,
  Shield,
  Bot,
  ArrowRight,
  ChevronRight,
  Star,
  Twitter,
  Facebook,
  Linkedin,
  Menu,
  X
} from "lucide-react";

export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: "Smart Automation",
      description: "Streamline complex workflows with intelligent automation that adapts to your business needs."
    },
    {
      icon: Brain,
      title: "AI-Powered Insights",
      description: "Gain actionable intelligence from your data with advanced machine learning algorithms."
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade security protocols protect your data at every stage of the automation process."
    }
  ];

  const services = [
    {
      title: "Process Automation",
      description: "Automate repetitive tasks across departments with our no-code workflow builder.",
      icon: Zap
    },
    {
      title: "Predictive Analytics",
      description: "Forecast market trends and customer behavior with our AI-driven analytics suite.",
      icon: Brain
    },
    {
      title: "Custom AI Solutions",
      description: "Tailored artificial intelligence models designed specifically for your unique business challenges.",
      icon: Bot
    }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "CTO, TechInnovate",
      content: "Dipex AI reduced our operational costs by 40% while increasing processing speed by 300%. The ROI was immediate.",
      rating: 5
    },
    {
      name: "Michael Chen",
      role: "Operations Director, Global Logistics",
      content: "The predictive maintenance module prevented over $2M in potential downtime last quarter. A game-changer for our industry.",
      rating: 5
    },
    {
      name: "Aisha Patel",
      role: "CEO, Finova Solutions",
      content: "Their AI-driven fraud detection system caught suspicious activities our legacy systems missed for months. Worth every penny.",
      rating: 5
    }
  ];

  return (
    <div className="font-sans text-gray-800 min-h-screen flex flex-col">
      {/* Navbar */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled ? "bg-white/80 backdrop-blur-sm shadow-sm py-3" : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div 
              className="flex items-center cursor-pointer"
              onClick={() => scrollToSection("hero")}
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 rounded-xl">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Dipex AI
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-10">
              <button 
                onClick={() => scrollToSection("features")}
                className="font-medium hover:text-indigo-600 transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection("services")}
                className="font-medium hover:text-indigo-600 transition-colors"
              >
                Services
              </button>
              <button 
                onClick={() => scrollToSection("testimonials")}
                className="font-medium hover:text-indigo-600 transition-colors"
              >
                Testimonials
              </button>
              <button 
                onClick={() => scrollToSection("contact")}
                className="font-medium hover:text-indigo-600 transition-colors"
              >
                Contact
              </button>
            </div>
            
            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <button className="px-4 py-2 font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                Sign In
              </button>
              <button 
                onClick={() => scrollToSection("contact")}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
            
            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6 text-gray-700" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            className="absolute right-0 top-0 h-full w-4/5 bg-white shadow-xl p-6 pt-24"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6 text-center">
              <button 
                onClick={() => scrollToSection("features")}
                className="block w-full py-3 text-lg font-medium text-gray-800 hover:text-indigo-600 transition-colors border-b border-gray-100"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection("services")}
                className="block w-full py-3 text-lg font-medium text-gray-800 hover:text-indigo-600 transition-colors border-b border-gray-100"
              >
                Services
              </button>
              <button 
                onClick={() => scrollToSection("testimonials")}
                className="block w-full py-3 text-lg font-medium text-gray-800 hover:text-indigo-600 transition-colors border-b border-gray-100"
              >
                Testimonials
              </button>
              <button 
                onClick={() => scrollToSection("contact")}
                className="block w-full py-3 text-lg font-medium text-gray-800 hover:text-indigo-600 transition-colors border-b border-gray-100"
              >
                Contact
              </button>
              <div className="pt-6 flex flex-col space-y-4">
                <button className="w-full py-3 font-medium text-indigo-600 hover:text-indigo-700 transition-colors border border-indigo-200 rounded-lg">
                  Sign In
                </button>
                <button 
                  onClick={() => scrollToSection("contact")}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Get Started
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Spacer for fixed navbar */}
      <div className="h-16 lg:h-20"></div>
      
      {/* Hero Section */}
      <section id="hero" className="pt-16 pb-20 lg:pt-24 lg:pb-32 bg-gradient-to-b from-indigo-50 to-white flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <div className="inline-block bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 text-sm font-medium px-4 py-1 rounded-full">
                Transforming businesses with AI
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Revolutionize Your Business with <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Intelligent Automation</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl">
                Dipex AI provides cutting-edge artificial intelligence and automation solutions that streamline operations, reduce costs, and accelerate growth for forward-thinking enterprises.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button 
                  onClick={() => scrollToSection("contact")}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-lg hover:opacity-90 transition-opacity flex items-center justify-center"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
                <button 
                  onClick={() => scrollToSection("features")}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-lg font-medium text-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
                >
                  Explore Features
                  <ChevronRight className="ml-2 h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center pt-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div 
                      key={i} 
                      className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold"
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <div className="ml-4">
                  <p className="font-medium">Trusted by 5,000+ enterprises</p>
                  <p className="text-gray-500 text-sm">Including Fortune 500 leaders</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-300 to-purple-400 rounded-3xl opacity-20 blur-2xl animate-pulse"></div>
              <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="text-sm font-mono text-gray-500">dipex-ai.dashboard</div>
                </div>
                <div className="p-8">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                          <Brain className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-4">
                          <p className="font-medium">AI Processing Engine</p>
                          <p className="text-sm text-gray-500">Real-time analysis</p>
                        </div>
                      </div>
                      <div className="bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full">
                        Active
                      </div>
                    </div>
                    
                    <div className="h-40 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-dashed border-indigo-200 flex items-center justify-center">
                      <div className="text-center">
                        <Zap className="h-12 w-12 text-indigo-400 mx-auto mb-2" />
                        <p className="text-gray-500">Live data visualization preview</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-2xl font-bold text-indigo-600">98.7%</p>
                        <p className="text-sm text-gray-500 mt-1">Accuracy</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-2xl font-bold text-purple-600">4.2x</p>
                        <p className="text-sm text-gray-500 mt-1">ROI Increase</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Modern Enterprises
            </h2>
            <p className="text-xl text-gray-600">
              Our platform combines cutting-edge AI with intuitive automation tools to solve your most complex business challenges.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-8 transition-all duration-300 hover:shadow-md hover:-translate-y-1"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mb-6">
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Services Section */}
      <section id="services" className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tailored AI Solutions for Every Enterprise
            </h2>
            <p className="text-xl text-gray-600">
              From process automation to predictive analytics, we deliver specialized AI services that drive measurable results.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md"
              >
                <div className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-center mb-6">
                    <service.icon className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{service.title}</h3>
                  <p className="text-gray-600 mb-6">{service.description}</p>
                  <button className="font-medium text-indigo-600 flex items-center hover:text-indigo-700 transition-colors">
                    Learn more
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Industry Leaders Worldwide
            </h2>
            <p className="text-xl text-gray-600">
              See how global enterprises are achieving extraordinary results with Dipex AI's intelligent automation platform.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-8 border border-gray-100 relative"
              >
                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-indigo-500 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center">
                  <Star className="h-8 w-8 text-white" />
                </div>
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 italic mb-6">"{testimonial.content}"</p>
                <div>
                  <p className="font-bold text-gray-900">{testimonial.name}</p>
                  <p className="text-indigo-600">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section id="contact" className="py-20 bg-gradient-to-r from-indigo-600 to-purple-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ready to Transform Your Business?
            </h2>
            <p className="text-xl text-indigo-100 max-w-2xl mx-auto">
              Start your 14-day free trial today and experience the power of intelligent automation. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <button className="px-8 py-4 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg">
                Start Free Trial
              </button>
              <button className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-colors">
                Schedule Demo
              </button>
            </div>
            <p className="text-indigo-200 pt-4">
              Join 5,000+ companies that trust Dipex AI with their automation needs
            </p>
          </motion.div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <div className="flex items-center">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-2 rounded-xl">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-white">Dipex AI</span>
              </div>
              <p className="mt-4 text-gray-400 max-w-xs">
                Revolutionizing business operations through intelligent automation and artificial intelligence.
              </p>
              <div className="flex space-x-4 mt-6">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Twitter className="h-6 w-6" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Facebook className="h-6 w-6" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Linkedin className="h-6 w-6" />
                </a>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-1 md:col-span-1 gap-8">
              <div>
                <h3 className="text-white font-bold mb-4">Solutions</h3>
                <ul className="space-y-3">
                  <li><a href="#" className="hover:text-white transition-colors">Process Automation</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Predictive Analytics</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Custom AI Models</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Intelligent Document Processing</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-white font-bold mb-4">Company</h3>
                <ul className="space-y-3">
                  <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Partners</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
                </ul>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <h3 className="text-white font-bold mb-4">Stay Updated</h3>
              <p className="text-gray-400 mb-6">
                Subscribe to our newsletter for the latest AI insights and product updates.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="email" 
                  placeholder="Your email address" 
                  className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                />
                <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity whitespace-nowrap">
                  Subscribe
                </button>
              </div>
              <div className="mt-8 pt-8 border-t border-gray-800 text-sm text-gray-500">
                <p>© {new Date().getFullYear()} Dipex AI. All rights reserved.</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                  <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                  <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                  <a href="#" className="hover:text-white transition-colors">Security</a>
                  <a href="#" className="hover:text-white transition-colors">Contact Us</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
