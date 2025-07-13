import _ from "lodash";
import { FormErrors, IAppState, ILot, ILotItem, IOrder, IOrderForm, LotStatus } from "../types";
import { dayjs, formatNumber } from "../utils/utils";
import { Model } from "./base/Model";

export type CatalogChangeEvent = {
    catalog: LotItem[]
};

export class LotItem extends Model<ILot> {
    id: string;
    title: string;
    about: string;
    description: string;
    image: string;
    status: LotStatus;
    datetime: string;
    price: number;
    minPrice: number;
    history: number[];

    protected myLastBid: number = 0;
    auctionStatus: string;

    clearBid() {
      this.myLastBid = 0;
    }

    placeBid(price: number) {
      this.price = price;
      this.myLastBid = price;
      this.history = [...this.history.slice(1), this.price]

      if(this.price >= this.minPrice*10) {
        this.status = 'closed';
      }
      this.emitChanges('auction:changed', {id: this.id, price});
    }

    get lotStatus(): string {
        switch(this.status) {
          case 'closed':
            return `Продано за ${formatNumber(this.price)}₽`;
          case 'active':
            return 'До закрытия аукциона: ';
          case 'wait':
            return 'До начала аукциона';
          default:
            return '';
        }
    }

    get isMyBid(): boolean {
      return this.myLastBid === this.price;
    }

    get isParticipant(): boolean {
      return this.myLastBid > 0;
    }

    get statusLabel():string {
      switch(this.status) {
         case 'closed':
            return `Закрыто ${dayjs(this.datetime).format('D MMMM [в] HH:mm')}`;
          case 'active':
            return `Открыто до ${dayjs(this.datetime).format('D MMMM [в] HH:mm')}`;
          case 'wait':
            return `Откроется ${dayjs(this.datetime).format('D MMMM [в] HH:mm')}`;
          default:
            return this.status;
        }
      }

    get TimeStatus():string {
      if(this.status === 'closed') {
        return 'Акцион завершён';
      }
      return dayjs
            .duration(dayjs(this.datetime).valueOf() - Date.now())
            .format('D[д] H[ч] m[ мин] s[ сек]');

    }

    get nextBid(): number {
      return Math.floor(this.price * 1.1);
    }
}

export class AppState extends Model<IAppState> {
  basket: string[];
  catalog: LotItem[];
  loading: boolean;
  order: IOrder = {
    email: '',
    phone: '',
    items: []
  }
  preview: string | null;
  formErrors: FormErrors = {};

  toggleOrderLot(id: string, isIncluded: boolean) {
    if(isIncluded) {
      this.order.items = _.uniq([...this.order.items, id]);
    } else {
      this.order.items = _.without(this.order.items, id);
    }
  }

  clearBasket() {
    this.order.items.forEach(id => {
      this.toggleOrderLot(id, false);
      this.catalog.find(item => item.id === id).clearBid();
    })
  }

  getTotal() {
    return this.order.items.reduce((a, b) => a + this.catalog.find(item => item.id === b).price, 0);
  }

  setCatalog(items: ILot[]) {
    this.catalog = items.map(item => new LotItem(item, this.events));
    this.emitChanges('items:changed', {catalog: this.catalog});
  }

  setPreview(item: LotItem) {
    this.preview = item.id;
    this.emitChanges('preview:changed', {item});
  }

  getActiveLots(): LotItem[] {
    return this.catalog.filter(item => item.status === 'active' && item.isParticipant);
  }

  getClosedLots(): LotItem[] {
    return this.catalog.filter(item => item.status === 'closed' && item.isMyBid);
  }

  setOrderField(field: keyof IOrderForm, value: string) {
    this.order[field] = value;

    this.emitChanges('order:ready', this.order);
  }

  validateOrder() {
    const errors: typeof this.formErrors = {};

    if(!this.order.email) {
      errors.email = 'Необходимо указать email';
    }
    if(!this.order.phone) {
      errors.phone = 'Необходимо указать телефон';
    }

    this.formErrors = errors;
    this.emitChanges('formErrors:changed', this.formErrors);
    return Object.keys(errors).length === 0;
  }
}