import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ActualizarConfigIaDto } from './dto/config-ia.dto.js';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

function validar(cuerpo: Record<string, unknown>) {
  return pipe.transform(cuerpo, { type: 'body', metatype: ActualizarConfigIaDto });
}

describe('ActualizarConfigIaDto', () => {
  it('acepta una configuración válida y normaliza la cadena', async () => {
    const dto = (await validar({
      proveedor: 'openrouter',
      modelo: 'modelo/x',
      cadenas: {
        edicion: [{ proveedor: 'openrouter', modelo: 'modelo/x' }, { proveedor: 'hf-space' }],
      },
    })) as ActualizarConfigIaDto;

    expect(dto.proveedor).toBe('openrouter');
    expect(dto.cadenas?.edicion).toHaveLength(2);
  });

  it.each(['apiKey', 'token', 'secret'])('rechaza el campo sensible %s', async (campo) => {
    await expect(
      validar({ proveedor: 'openrouter', [campo]: 'valor-secreto' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza Ollama y proveedores desconocidos', async () => {
    await expect(validar({ proveedor: 'ollama' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validar({ cadenas: { edicion: [{ proveedor: 'anthropic' }] } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una cadena vacía', async () => {
    await expect(validar({ cadenas: { consulta: [] } })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza campos desconocidos dentro de un tramo', async () => {
    await expect(
      validar({ cadenas: { edicion: [{ proveedor: 'openrouter', apiKey: 'x' }] } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
