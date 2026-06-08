import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../lib/cartStore';
import { useLang } from '../lib/i18n';
import { syncNow } from '../lib/syncService';
import { sendBookingEmail, isEmailConfigured } from '../lib/emailService';


// ─── Generate unique confirmation number ───
function generateConfirmationNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CEB-${code}`;
}

// ─── Build mailto URL with booking details ───
function buildMailtoUrl(booking: {
  confirmationNumber: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  items: { name: string; price: number; quantity: number; date?: string | null }[];
  total: number;
}): string {
  const to = 'cebacoco@isekaisland.com';

  const subject = `[${booking.confirmationNumber}] New Booking: ${booking.customerName || 'Guest'} - $${booking.total.toFixed(2)}`;

  const itemLines = booking.items
    .map((i) => {
      let line = `- ${i.name} x${i.quantity} = $${(i.price * i.quantity).toFixed(2)}`;
      if (i.date) line += ` (${i.date})`;
      return line;
    })
    .join('\n');

  const contactInfo = [
    booking.customerEmail ? `Email: ${booking.customerEmail}` : null,
    booking.customerWhatsapp ? `WhatsApp: ${booking.customerWhatsapp}` : null,
  ].filter(Boolean).join('\n');

  const body = `New Booking Request - CEBACO Island

========================================
CONFIRMATION: ${booking.confirmationNumber}
STATUS: PENDING CONFIRMATION
========================================

Customer: ${booking.customerName || 'Unknown'}
${contactInfo}

Items:
${itemLines}

Total: $${booking.total.toFixed(2)}

========================================

Please contact the customer to confirm their booking and arrange transportation details.
Confirmation Number: ${booking.confirmationNumber}`;

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

interface CartSidebarProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToBoat?: () => void;
  onBookingComplete?: (booking: {
    confirmationNumber: string;
    customerName: string;
    customerEmail: string;
    customerWhatsapp: string;
    items: { name: string; price: number; quantity: number; date?: string | null }[];
    total: number;
    emailSent: boolean;
  }) => void;
}

type CheckoutStep = 'cart' | 'contact' | 'sending' | 'success' | 'error';

export default function CartSidebar({ visible, onClose, onNavigateToBoat, onBookingComplete }: CartSidebarProps) {
  const { t } = useLang();
  const { items, removeItem, updateQuantity, clearCart, totalPrice, totalItems } = useCart();
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [showBoatRequired, setShowBoatRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  const finalTotal = Number(totalPrice);

  // A valid trip needs a boat reservation (beach + day). Boat items have id starting with "boat-".
  const hasBoatReservation = items.some(i => typeof i.id === 'string' && i.id.startsWith('boat-'));

  const handleProceedToCheckout = () => {
    if (items.length === 0) {
      setValidationError(t('add_activities_hint'));
      return;
    }
    // Require a boat reservation (beach + day) before checkout.
    if (!hasBoatReservation) {
      setShowBoatRequired(true);
      return;
    }
    setValidationError('');
    setStep('contact');
  };

  const goReserveBoat = () => {
    setShowBoatRequired(false);
    onClose();
    if (onNavigateToBoat) {
      setTimeout(() => onNavigateToBoat(), 350);
    }
  };


  const handleSendBooking = async () => {
    setValidationError('');
    if (!customerName.trim()) {
      setValidationError(t('please_enter_name'));
      return;
    }
    if (!customerEmail.trim() && !customerWhatsapp.trim()) {
      setValidationError(t('please_provide_contact'));
      return;
    }

    setStep('sending');
    setErrorMessage('');

    // ─── Sync reservations from GitHub before booking ───
    try {
      console.log('[CartSidebar] Syncing reservations before booking...');
      await syncNow();
      console.log('[CartSidebar] Sync complete, proceeding with booking');
    } catch (syncErr) {
      console.warn('[CartSidebar] Sync failed, proceeding anyway:', syncErr);
    }

    // Generate confirmation number
    const confirmationNumber = generateConfirmationNumber();

    const bookingData = {
      confirmationNumber,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerWhatsapp: customerWhatsapp.trim(),
      items: items.map(item => ({
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        date: item.date || null,
      })),
      total: finalTotal,
    };

    let emailSent = false;

    // ─── Try sending email directly via SMTP2GO ───
    try {
      console.log('[CartSidebar] Sending booking email via SMTP2GO...');
      const result = await sendBookingEmail(bookingData);

      if (result.success) {
        emailSent = true;
        console.log('[CartSidebar] Email sent successfully via SMTP2GO!');
      } else {
        console.warn('[CartSidebar] SMTP2GO failed:', result.error);
        // If SMTP2GO is not configured or fails, try mailto fallback
        throw new Error(result.error || 'SMTP2GO send failed');
      }

      // Notify parent about completed booking
      if (onBookingComplete) {
        onBookingComplete({
          ...bookingData,
          emailSent,
        });
      }

      setStep('success');

    } catch (smtp2goErr: any) {
      console.warn('[CartSidebar] SMTP2GO failed, falling back to mailto:', smtp2goErr);

      // ─── Fallback: open device email client ───
      try {
        const mailtoUrl = buildMailtoUrl(bookingData);
        const canOpen = await Linking.canOpenURL(mailtoUrl);

        if (canOpen) {
          await Linking.openURL(mailtoUrl);
          emailSent = true;
        }

        // Notify parent about completed booking
        if (onBookingComplete) {
          onBookingComplete({
            ...bookingData,
            emailSent,
          });
        }

        setStep('success');

      } catch (mailtoErr: any) {
        console.error('[CartSidebar] Both email methods failed:', mailtoErr);
        setErrorMessage(mailtoErr?.message || t('something_wrong'));
        setStep('error');
      }
    }

  };





  const handleClose = () => {
    if (step === 'success') {
      clearCart();
      setCustomerName('');
      setCustomerEmail('');
      setCustomerWhatsapp('');
    }
    setStep('cart');
    onClose();
  };

  const handleBackToCart = () => {
    setStep('cart');
  };

  const handleDoneSuccess = () => {
    clearCart();
    setCustomerName('');
    setCustomerEmail('');
    setCustomerWhatsapp('');
    setStep('cart');
    onClose();
  };

  // ==================== CONTACT STEP ====================
  const renderContactStep = () => (
    <>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={handleBackToCart} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#0D9488" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{t('your_details')}</Text>
            <Text style={styles.subtitle}>{t('how_reach_you')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.contactForm}>
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Ionicons name="person" size={14} color="#0D9488" />
              <Text style={styles.inputLabel}>{t('full_name_required')}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={t('your_name')}
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Ionicons name="mail" size={14} color="#0D9488" />
              <Text style={styles.inputLabel}>{t('email')}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={customerEmail}
              onChangeText={setCustomerEmail}
              placeholder="your@email.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
              <Text style={styles.inputLabel}>{t('whatsapp_number')}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={customerWhatsapp}
              onChangeText={setCustomerWhatsapp}
              placeholder="+507 6XXX-XXXX"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.contactNote}>
            <Ionicons name="information-circle" size={16} color="#64748B" />
            <Text style={styles.contactNoteText}>
              {t('contact_note')}
            </Text>
          </View>

          {/* Auto-send info note */}
          <View style={[styles.contactNote, { backgroundColor: '#F0FDFA', marginTop: 10 }]}>
            <Ionicons name="send" size={16} color="#0D9488" />
            <Text style={[styles.contactNoteText, { color: '#0D9488' }]}>
              Your booking will be sent automatically. You will receive a confirmation shortly.
            </Text>
          </View>


        </View>

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.orderSummaryTitle}>{t('order_summary')}</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.summaryItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.summaryItemDetail}>
                  ${Number(item.price).toFixed(2)} x {item.quantity}
                  {item.date ? ` — ${item.date}` : ''}
                </Text>
              </View>
              <Text style={styles.summaryItemTotal}>
                ${(Number(item.price) * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={styles.summaryDivider} />
          <View style={[styles.summaryRow, { marginTop: 4, paddingTop: 8 }]}>
            <Text style={styles.summaryTotalLabel}>{t('total')}</Text>
            <Text style={styles.summaryTotalValue}>${finalTotal.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {/* Promo code */}
        <View style={{ marginBottom: 12 }}>
          <View style={styles.inputLabelRow}>
            <Ionicons name="pricetag" size={14} color="#0D9488" />
            <Text style={styles.inputLabel}>Promo code</Text>
          </View>
          <TextInput
            style={styles.input}
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="Enter promo code (optional)"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
          <Text style={{ fontSize: 11, color: '#0D9488', marginTop: 6, lineHeight: 16 }}>
            If your promo code is valid, the corresponding % discount will be applied and confirmed by email with the rest of your booking details.
          </Text>
        </View>
        {validationError ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={{ fontSize: 13, color: '#DC2626', flex: 1, lineHeight: 18 }}>{validationError}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.sendBookingBtn} onPress={handleSendBooking} activeOpacity={0.8}>
          <Ionicons name="send" size={18} color="#fff" />
          <Text style={styles.sendBookingText}>{t('send_booking_request')}</Text>

        </TouchableOpacity>
      </View>
    </>
  );

  // ==================== BOAT REQUIRED POPUP ====================
  const renderBoatRequiredPopup = () => (
    <Modal visible={showBoatRequired} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 28 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Ionicons name="boat" size={32} color="#0D9488" />
          </View>
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#0F172A', textAlign: 'center' }}>
            Your boat is waiting!
          </Text>
          <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 21 }}>
            Every adventure starts with the boat. You haven't picked a beach and a day yet — let's set sail first, then add the rest of your trip.
          </Text>
          <TouchableOpacity
            style={[styles.sendBookingBtn, { marginTop: 22, alignSelf: 'stretch' }]}
            onPress={goReserveBoat}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.sendBookingText}>Take me to the boat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingVertical: 12, marginTop: 4 }} onPress={() => setShowBoatRequired(false)}>
            <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '600' }}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );



  // ==================== SENDING STEP ====================
  const renderSendingStep = () => (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color="#0D9488" />
      <Text style={styles.sendingTitle}>{t('sending_booking')}</Text>
      <Text style={styles.sendingSubtitle}>{t('please_wait_processing')}</Text>
    </View>
  );

  // ==================== SUCCESS STEP ====================
  const renderSuccessStep = () => (
    <View style={styles.centerState}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={64} color="#10B981" />
      </View>
      <Text style={styles.successTitle}>{t('booking_sent')}</Text>
      <Text style={styles.successSubtitle}>
        {t('booking_sent_subtitle')}
        {customerWhatsapp ? ` ${t('via_whatsapp', { number: customerWhatsapp })}` : ''}
        {customerEmail ? `${customerWhatsapp ? ' or' : ''} ${t('at_email', { email: customerEmail })}` : ''}
        {' '}{t('to_confirm')}
      </Text>
      <View style={styles.successSummary}>
        <Text style={styles.successSummaryText}>
          {totalItems} {t('items')} — ${finalTotal.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity style={styles.doneBtn} onPress={handleDoneSuccess} activeOpacity={0.8}>
        <Text style={styles.doneBtnText}>{t('done')}</Text>
      </TouchableOpacity>
    </View>
  );

  // ==================== ERROR STEP ====================
  const renderErrorStep = () => (
    <View style={styles.centerState}>
      <View style={styles.errorIcon}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
      </View>
      <Text style={styles.errorTitle}>{t('oops_error')}</Text>
      <Text style={styles.errorSubtitle}>{errorMessage}</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={() => setStep('contact')}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh" size={18} color="#fff" />
        <Text style={styles.retryBtnText}>{t('try_again')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelRetryBtn} onPress={handleClose}>
        <Text style={styles.cancelRetryText}>{t('cancel')}</Text>
      </TouchableOpacity>
    </View>
  );

  // ==================== CART STEP ====================
  const renderCartStep = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('cart_title')}</Text>
          <Text style={styles.subtitle}>{totalItems} {t('items')}</Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="compass-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>{t('cart_empty')}</Text>
            <Text style={styles.emptyText}>
              {t('cart_empty_sub')}
            </Text>
          </View>
        ) : (
          <>
            {items.map((item) => (
              <View key={item.id} style={styles.cartItem}>
                {item.image_url && (
                  <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                )}
                <View style={styles.itemContent}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemPrice}>
                    ${Number(item.price).toFixed(2)} x {item.quantity}
                  </Text>
                  {item.date && (
                    <Text style={styles.itemDate}>{item.date}</Text>
                  )}
                  <View style={styles.itemActions}>
                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Ionicons name="remove" size={14} color="#64748B" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Ionicons name="add" size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(item.id)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.itemTotal}>
                  ${(Number(item.price) * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('total')}</Text>
            <Text style={styles.totalAmount}>${finalTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={handleProceedToCheckout} activeOpacity={0.8}>
            <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
            <Text style={styles.checkoutText}>{t('book_now', { price: finalTotal.toFixed(2) })}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={clearCart}>
            <Text style={styles.clearText}>{t('clear_all')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />
          {step === 'cart' && renderCartStep()}
          {step === 'contact' && renderContactStep()}
          {step === 'sending' && renderSendingStep()}
          {step === 'success' && renderSuccessStep()}
          {step === 'error' && renderErrorStep()}
        </View>
      </View>
      {renderBoatRequiredPopup()}
    </Modal>
  );
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 250,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemPrice: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  itemDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D9488',
    marginLeft: 8,
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  totalAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  clearText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // ===== Contact Step =====
  contactForm: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FAFBFC',
  },
  contactNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  contactNoteText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 18,
  },

  // Order Summary in contact step
  orderSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  orderSummaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  summaryItemDetail: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  summaryItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 12,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0D9488',
  },

  // Send booking button
  sendBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBookingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ===== Center States (sending, success, error) =====
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  sendingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 20,
  },
  sendingSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },

  // Success
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  successSummary: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 20,
  },
  successSummaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D9488',
  },
  doneBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 24,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Error
  errorIcon: {
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 24,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelRetryBtn: {
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelRetryText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
