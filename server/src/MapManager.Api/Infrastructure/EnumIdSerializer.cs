using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace MapManager.Api.Infrastructure;

/// <summary>Stores an enum value as its id string (see <see cref="EnumIds"/>), for example "jeep".</summary>
/// <typeparam name="TEnum">The enum type.</typeparam>
public sealed class EnumIdSerializer<TEnum> : StructSerializerBase<TEnum> where TEnum : struct, Enum
{
    public override void Serialize(BsonSerializationContext context, BsonSerializationArgs args, TEnum value) =>
        context.Writer.WriteString(EnumIds.ToId(value));

    public override TEnum Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        var id = context.Reader.ReadString();
        return EnumIds.TryParse<TEnum>(id, out var value)
            ? value
            : throw new FormatException($"'{id}' is not a valid {typeof(TEnum).Name} id.");
    }
}
