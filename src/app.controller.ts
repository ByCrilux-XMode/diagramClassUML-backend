import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { EsPublico } from './modules/auth/decoradores/publico.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @EsPublico()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
